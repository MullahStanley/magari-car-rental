-- Ensure public.profiles has the columns the signup trigger (handle_new_user)
-- expects. Live databases created from an earlier schema version were missing
-- full_name/avatar_url, which made the trigger error out and roll back every
-- sign-up. Fresh databases get these columns from migration 001; this makes
-- the fix reproducible for any environment.
alter table if exists public.profiles add column if not exists full_name text;
alter table if exists public.profiles add column if not exists avatar_url text;
