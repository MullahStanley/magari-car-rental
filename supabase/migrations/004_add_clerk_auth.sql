-- ────────────────────────────────────────────────────────────
-- 004: Clerk auth — decouple profiles from Supabase Auth
-- ────────────────────────────────────────────────────────────
-- Identity is now handled by Clerk. profiles.id stays the stable PK
-- referenced by bookings, but new rows are created for Clerk users
-- (keyed by clerk_id) instead of Supabase auth.users rows.

-- 1. Map Clerk user IDs to profiles.
alter table public.profiles add column if not exists clerk_id text;

create unique index if not exists profiles_clerk_id_key
  on public.profiles (clerk_id)
  where clerk_id is not null;

-- 2. New profile rows get an app-generated UUID (Clerk users have no
--    auth.users row to reference).
alter table public.profiles alter column id set default gen_random_uuid();

-- 3. Drop the FK to auth.users so Clerk-user profiles can be inserted.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 4. The auto-create trigger only fires on auth.users inserts, which no
--    longer happen under Clerk. Drop it (and its function) to avoid
--    confusion and stale behavior.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
