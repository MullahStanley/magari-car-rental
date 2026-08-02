import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Auth is handled by Clerk, so this client uses the SERVICE ROLE key.
 * The service role bypasses RLS — all authorization is enforced at the
 * app layer via Clerk's `auth()` / `currentUser()` (e.g. admin role
 * checks and per-user booking filters).
 */
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
