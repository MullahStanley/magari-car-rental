-- ============================================================
-- Magari Car Rental — Initial Schema, RLS & Storage Policies
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. Profiles (linked to Supabase Auth)
-- ────────────────────────────────────────────────────────────
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text,
    avatar_url text,
    role text default 'user' check (role in ('user', 'admin')),
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);

create policy "Users can insert own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
        new.raw_user_meta_data ->> 'avatar_url'
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 2. Vehicles
-- ────────────────────────────────────────────────────────────
create table public.vehicles (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    brand text not null,
    category text not null,
    daily_rate numeric not null check (daily_rate > 0),
    model_3d_url text not null,
    image_url text,
    description text,
    is_available boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.vehicles enable row level security;

create policy "Anyone can read available vehicles"
    on public.vehicles for select
    using (is_available = true);

create policy "Admins can read all vehicles"
    on public.vehicles for select
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can insert vehicles"
    on public.vehicles for insert
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can update vehicles"
    on public.vehicles for update
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can delete vehicles"
    on public.vehicles for delete
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- ────────────────────────────────────────────────────────────
-- 3. Bookings
-- ────────────────────────────────────────────────────────────
create table public.bookings (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    vehicle_id uuid references public.vehicles(id) on delete cascade not null,
    start_date date not null,
    end_date date not null,
    total_price numeric not null check (total_price > 0),
    status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint valid_date_range check (end_date >= start_date)
);

alter table public.bookings enable row level security;

create policy "Users can view own bookings"
    on public.bookings for select
    using (auth.uid() = user_id);

create policy "Users can create own bookings"
    on public.bookings for insert
    with check (auth.uid() = user_id);

create policy "Users can update own bookings"
    on public.bookings for update
    using (auth.uid() = user_id);

create policy "Admins can view all bookings"
    on public.bookings for select
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- ────────────────────────────────────────────────────────────
-- 4. Booking overlap prevention (server-side validation)
-- ────────────────────────────────────────────────────────────
create or replace function public.check_booking_overlap()
returns trigger
language plpgsql
as $$
begin
    if exists (
        select 1 from public.bookings
        where vehicle_id = new.vehicle_id
          and status in ('pending', 'confirmed')
          and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and start_date < new.end_date
          and end_date > new.start_date
    ) then
        raise exception 'Vehicle is already booked for the selected dates';
    end if;
    return new;
end;
$$;

create trigger prevent_booking_overlap
    before insert or update on public.bookings
    for each row execute function public.check_booking_overlap();

-- ────────────────────────────────────────────────────────────
-- 5. Storage bucket: vehicle-assets
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('vehicle-assets', 'vehicle-assets', true)
on conflict (id) do nothing;

-- Public read access for 3D models
create policy "Public read access for vehicle assets"
    on storage.objects for select
    using (bucket_id = 'vehicle-assets');

-- Admin-only write/delete
create policy "Admins can upload vehicle assets"
    on storage.objects for insert
    with check (
        bucket_id = 'vehicle-assets'
        and exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can update vehicle assets"
    on storage.objects for update
    using (
        bucket_id = 'vehicle-assets'
        and exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can delete vehicle assets"
    on storage.objects for delete
    using (
        bucket_id = 'vehicle-assets'
        and exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- ────────────────────────────────────────────────────────────
-- 6. Seed data (sample vehicles)
-- ────────────────────────────────────────────────────────────
insert into public.vehicles (name, brand, category, daily_rate, model_3d_url, description) values
    ('Model X', 'Tesla', 'Sports', 299.00, 'models/tesla-model-x.glb', 'Electric performance sedan with ludicrous acceleration.'),
    ('M3 Touring', 'BMW', 'SUV', 189.00, 'models/bmw-x5.glb', 'Luxury SUV with commanding presence and all-wheel drive.'),
    ('A-45 AMG', 'Mercedes-Benz', 'Hatchback', 149.00, 'models/mercedes-a45-amg.glb', 'Elegant executive sedan with premium comfort.'),
    ('911 Carrera', 'Porsche', 'Sports', 399.00, 'models/porsche-911.glb', 'Iconic sports car with precision engineering.'),
    ('Range Rover Sport', 'Land Rover', 'SUV', 249.00, 'models/range-rover-sport.glb', 'Versatile luxury SUV for any terrain.'),
    ('Honda Passport Trailsport 2026', 'Honda', 'SUV', 129.00, 'models/honda-passport.glb', 'Refined suv with all-wheel drive.');
