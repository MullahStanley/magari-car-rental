-- ============================================================
-- 7. M-Pesa payments (Daraja STK push) + renter details
-- ============================================================
--
-- Flow: customer submits a booking with renter details (pending)
-- → admin approves, which fires an M-Pesa STK push (awaiting_payment)
-- → Daraja callback marks the payment paid and auto-confirms the
--   booking (confirmed).

-- ────────────────────────────────────────────────────────────
-- 1. Renter details collected at booking time
-- ────────────────────────────────────────────────────────────
alter table public.bookings
    add column if not exists renter_name text,
    add column if not exists renter_email text,
    add column if not exists renter_phone text,
    add column if not exists national_id text,
    add column if not exists drivers_license text;

-- ────────────────────────────────────────────────────────────
-- 2. New status: awaiting_payment (approved, STK push sent)
-- ────────────────────────────────────────────────────────────
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
    add constraint bookings_status_check
    check (status in ('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed'));

-- A booking awaiting payment still holds the vehicle's dates.
create or replace function public.check_booking_overlap()
returns trigger
language plpgsql
as $$
begin
    if exists (
        select 1 from public.bookings
        where vehicle_id = new.vehicle_id
          and status in ('pending', 'awaiting_payment', 'confirmed')
          and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and start_date < new.end_date
          and end_date > new.start_date
    ) then
        raise exception 'Vehicle is already booked for the selected dates';
    end if;
    return new;
end;
$$;

drop trigger if exists prevent_booking_overlap on public.bookings;
create trigger prevent_booking_overlap
    before insert or update on public.bookings
    for each row execute function public.check_booking_overlap();

-- ────────────────────────────────────────────────────────────
-- 3. Tighten user update RLS: users may only cancel their own
--    booking. Self-confirming (without paying) is no longer
--    possible now that "confirmed" implies payment received.
-- ────────────────────────────────────────────────────────────
drop policy if exists "Users can update own bookings" on public.bookings;
create policy "Users can update own bookings"
    on public.bookings for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id and status = 'cancelled');

-- ────────────────────────────────────────────────────────────
-- 4. Payments ledger (one row per STK push attempt)
-- ────────────────────────────────────────────────────────────
create table if not exists public.payments (
    id uuid default gen_random_uuid() primary key,
    booking_id uuid references public.bookings(id) on delete cascade not null,
    amount numeric not null check (amount > 0),
    phone text not null,
    status text default 'initiated' check (status in ('initiated', 'paid', 'failed')),
    checkout_request_id text,
    merchant_request_id text,
    mpesa_receipt text,
    result_desc text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_payments_booking_id on public.payments (booking_id);
create unique index if not exists idx_payments_checkout_request
    on public.payments (checkout_request_id)
    where checkout_request_id is not null;

alter table public.payments enable row level security;

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
    on public.payments for select
    to authenticated
    using (
        exists (
            select 1 from public.bookings b
            where b.id = booking_id and b.user_id = auth.uid()
        )
    );

drop policy if exists "Admins can view all payments" on public.payments;
create policy "Admins can view all payments"
    on public.payments for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

-- ────────────────────────────────────────────────────────────
-- 5. Admin helpers: expose renter + latest payment info
-- ────────────────────────────────────────────────────────────
-- The return type of admin_get_bookings changes (new renter + payment
-- columns), so DROP it first — CREATE OR REPLACE can't alter OUT params.
drop function if exists public.admin_get_bookings();

create function public.admin_get_bookings()
returns table (
    id uuid,
    user_id uuid,
    vehicle_id uuid,
    start_date date,
    end_date date,
    total_price double precision,
    status text,
    created_at timestamptz,
    vehicle_name text,
    vehicle_brand text,
    vehicle_category text,
    vehicle_image_url text,
    user_full_name text,
    renter_name text,
    renter_email text,
    renter_phone text,
    national_id text,
    drivers_license text,
    payment_status text,
    payment_receipt text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.role = 'admin'
    ) then
        raise exception 'Forbidden: admin role required';
    end if;

    return query
    select
        b.id,
        b.user_id,
        b.vehicle_id,
        b.start_date,
        b.end_date,
        b.total_price::float8,
        b.status,
        b.created_at,
        v.name,
        v.brand,
        v.category,
        v.image_url,
        p.full_name,
        b.renter_name,
        b.renter_email,
        b.renter_phone,
        b.national_id,
        b.drivers_license,
        pay.status,
        pay.mpesa_receipt
    from public.bookings b
    join public.vehicles v on v.id = b.vehicle_id
    left join public.profiles p on p.id = b.user_id
    left join lateral (
        select pay2.status, pay2.mpesa_receipt
        from public.payments pay2
        where pay2.booking_id = b.id
        order by pay2.created_at desc
        limit 1
    ) pay on true
    order by
        case b.status when 'pending' then 0 when 'awaiting_payment' then 1 when 'confirmed' then 2 else 3 end,
        b.created_at desc;
end;
$$;

-- Allow the new status through the admin status-change RPC.
create or replace function public.admin_update_booking_status(
    p_booking_id uuid,
    p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.role = 'admin'
    ) then
        raise exception 'Forbidden: admin role required';
    end if;

    if p_status is null or p_status not in ('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed') then
        raise exception 'Invalid status: %', p_status;
    end if;

    if exists (
        select 1 from public.bookings
        where id = p_booking_id and status = 'completed'
    ) then
        raise exception 'Completed bookings cannot be changed';
    end if;

    update public.bookings
    set status = p_status
    where id = p_booking_id;

    if not found then
        raise exception 'Booking not found';
    end if;
end;
$$;

-- Only authenticated users may call these (each function verifies admin).
revoke execute on function public.admin_get_bookings() from public, anon;
revoke execute on function public.admin_update_booking_status(uuid, text) from public, anon;
grant execute on function public.admin_get_bookings() to authenticated;
grant execute on function public.admin_update_booking_status(uuid, text) to authenticated;
