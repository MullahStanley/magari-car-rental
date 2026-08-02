-- ────────────────────────────────────────────────────────────
-- 005: Revert Clerk auth — restore Supabase Auth profile wiring
-- ────────────────────────────────────────────────────────────
-- Identity returns to Supabase Auth (Clerk was removed from the app).
-- Migration 004 dropped the signup trigger, its function, and the FK
-- from profiles.id to auth.users. This restores them so new Supabase
-- sign-ups get a profiles row again (needed for roles/admin checks).

-- 1. Re-create the signup trigger function (identical to migration 001).
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

-- 2. Re-create the trigger on auth.users inserts.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- 3. Re-add the FK from profiles.id to auth.users (dropped by 004).
--    Safe to validate immediately: every existing profile id maps to an
--    auth.users row (no Clerk-era orphan rows were ever created).
alter table public.profiles
    drop constraint if exists profiles_id_fkey;
alter table public.profiles
    add constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade;

-- 4. profiles.id is again always the Supabase auth.users id — drop the
--    Clerk-era app-generated-UUID default.
alter table public.profiles alter column id drop default;

-- 5. Drop the unused Clerk-era column and its index (no rows use it).
drop index if exists profiles_clerk_id_key;
alter table public.profiles drop column if exists clerk_id;
