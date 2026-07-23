-- ============================================================
-- Magari Car Rental — Initial Schema, RLS & Storage Policies
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. Profiles (linked to Supabase Auth)
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text,
    avatar_url text,
    role text default 'user' check (role in ('user', 'admin')),
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

--dropping existing policies to avoid conflicts
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile"
    on public.profiles for select
    to authenticated
    using ( (select auth.uid()) = id );

create policy "Users can update own profile"
    on public.profiles for update
    to authenticated
    using ( (select auth.uid()) = id );

create policy "Users can insert own profile"
    on public.profiles for insert
    to authenticated
    with check ( (select auth.uid()) = id );

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

--drop existing trigger to avoid conflicts
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users cascade;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 2. Vehicles
-- ────────────────────────────────────────────────────────────
create table if not exists public.vehicles (
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

--dropping existing policies to avoid conflicts
drop policy if exists "Anyone can read available vehicles" on public.vehicles;
drop policy if exists "Admins can read all vehicles" on public.vehicles;
drop policy if exists "Admins can insert vehicles" on public.vehicles;
drop policy if exists "Admins can update vehicles" on public.vehicles;
drop policy if exists "Admins can delete vehicles" on public.vehicles;

create policy "Anyone can read available vehicles"
    on public.vehicles for select
    to anon, authenticated
    using (is_available = true);

create policy "Admins can read all vehicles"
    on public.vehicles for select
    to service_role, authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can insert vehicles"
    on public.vehicles for insert
    to service_role, authenticated
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can update vehicles"
    on public.vehicles for update
    to service_role, authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can delete vehicles"
    on public.vehicles for delete
    to service_role, authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- ────────────────────────────────────────────────────────────
-- 3. Bookings
-- ────────────────────────────────────────────────────────────
create table if not exists public.bookings (
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

--dropping existing policies to avoid conflicts
drop policy if exists "Users can view own bookings" on public.bookings;
drop policy if exists "Users can create own bookings" on public.bookings;
drop policy if exists "Users can update own bookings" on public.bookings;
drop policy if exists "Admins can view all bookings" on public.bookings;

create policy "Users can view own bookings"
    on public.bookings for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Users can create own bookings"
    on public.bookings for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "Users can update own bookings"
    on public.bookings for update
    to authenticated
    using (auth.uid() = user_id);

create policy "Admins can view all bookings"
    on public.bookings for select
    to service_role, authenticated
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

--drop existing trigger to avoid conflicts
drop trigger if exists prevent_booking_overlap on public.bookings;
drop trigger if exists prevent_booking_overlap on public.bookings cascade;

create trigger prevent_booking_overlap
    before insert or update on public.bookings
    for each row execute function public.check_booking_overlap();

-- ────────────────────────────────────────────────────────────
-- 5. Storage bucket: vehicle-assets
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('vehicle-assets', 'vehicle-assets', true)
on conflict (id) do nothing;

--dropping existing policies to avoid conflicts
drop policy if exists "Public read access for vehicle assets" on storage.objects;
drop policy if exists "Admins can upload vehicle assets" on storage.objects;
drop policy if exists "Admins can update vehicle assets" on storage.objects;
drop policy if exists "Admins can delete vehicle assets" on storage.objects;

-- Public read access for 3D models
create policy "Public read access for vehicle assets"
    on storage.objects for select
    to public
    using (bucket_id = 'vehicle-assets');

-- Admin-only write/delete
create policy "Admins can upload vehicle assets"
    on storage.objects for insert
    to service_role, authenticated
    with check (
        bucket_id = 'vehicle-assets'
        and exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can update vehicle assets"
    on storage.objects for update
    to service_role, authenticated
    using (
        bucket_id = 'vehicle-assets'
        and exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create policy "Admins can delete vehicle assets"
    on storage.objects for delete
    to service_role, authenticated
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
    ('Model X 2020', 'Tesla', 'Sports', 4000.00, 'models/tesla-model_x_2020.glb', 'Electric performance sedan with ludicrous acceleration.'),
    ('M3 Touring 2023', 'BMW', 'Station Wagon', 10000.00, 'models/2023_bmw_m3_touring.glb', 'Luxury station wagon with commanding presence and all-wheel drive.'),
    ('A-45 AMG 2018', 'Mercedes-Benz', 'Hatchback', 4000.00, 'models/mercedes-benz_a45_amg_2018.glb', 'Elegant hatchback with premium comfort and a heavy road presence.'),
    ('Maybach 2022', 'Mercedes-Maybach', 'Sedan', 40000.00, 'models/mercedes-benz_maybach_2022.glb', 'Luxury sedan with unparalleled comfort and performance.'),
    ('Swift 2024', 'Suzuki', 'Sports', 2000.00, 'models/2024_suzuki_swift_hybrid_plus.glb', 'Iconic sports car with precision engineering.'),
    ('S-Cross 4x2 GLX 2024', 'Suzuki', 'CUV', 3500.00, 'models/2024_suzuki_s-cross_4x2_glx_hybrid.glb', 'Gives the premium feel of a luxury SUV with the efficiency of a compact car'),
    ('Range Rover Supercharged 2006', 'Land Rover', 'SUV', 12000.00, 'models/2006_land_rover_range_rover_supercharged.glb', 'Versatile luxury SUV for any terrain.'),
    ('Toyota Hilux 2022', 'Toyota', 'SUV', 10000.00, 'models/2022_toyota_hilux.glb', 'Rugged and reliable SUV for off-road adventures.'),
    ('Integra DB8 Type-R 2007', 'Honda', 'Sports', 4500.00, 'models/honda_integra_db8_type-r.glb', 'Highly sought-after JDM classic offering a thrilling driving experience.'),
    ('Fortuner 2021', 'Toyota', 'SUV', 10000.00, 'models/toyota_fortuner_2021.glb', 'Rugged and reliable SUV for off-road adventures.');
