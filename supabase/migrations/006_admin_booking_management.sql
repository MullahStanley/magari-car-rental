-- ============================================================
-- 6. Admin booking management (review + confirm pending bookings)
-- ============================================================
--
-- RLS only lets users see/update their own bookings, so admins need
-- helper functions. They run as security definer (bypassing RLS) and
-- self-check that the caller is an admin before doing anything.

-- Fetch every booking joined with vehicle + user display info,
-- ordered with pending requests first.
create or replace function public.admin_get_bookings()
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
    user_full_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
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
        p.full_name
    from public.bookings b
    join public.vehicles v on v.id = b.vehicle_id
    left join public.profiles p on p.id = b.user_id
    order by
        case b.status when 'pending' then 0 when 'confirmed' then 1 else 2 end,
        b.created_at desc;
end;
$$;

-- Change a booking's status (confirm / decline / complete / cancel).
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
        where id = auth.uid() and role = 'admin'
    ) then
        raise exception 'Forbidden: admin role required';
    end if;

    if p_status is null or p_status not in ('pending', 'confirmed', 'cancelled', 'completed') then
        raise exception 'Invalid status: %', p_status;
    end if;

    -- Completed bookings are final — do not let them be resurrected/cancelled.
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
