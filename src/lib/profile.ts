import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export interface ProfileInput {
  fullName?: string | null;
  email?: string | null;
}

/**
 * Look up a profile row by its Clerk user ID (profiles.clerk_id).
 */
export async function getProfileByClerkId(
  clerkId: string
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_id", clerkId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/**
 * Get the profile for a Clerk user, creating one lazily on first use.
 * This replaces the old Supabase `handle_new_user` trigger: Clerk is the
 * identity provider, so rows are created when a user first needs one.
 */
export async function getOrCreateProfile(
  clerkId: string,
  input: ProfileInput = {}
): Promise<Profile | null> {
  const existing = await getProfileByClerkId(clerkId);
  if (existing) return existing;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      clerk_id: clerkId,
      full_name: input.fullName ?? input.email ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // Race: another request may have created it between select and insert.
    const raced = await getProfileByClerkId(clerkId);
    return raced;
  }

  return (data as Profile) ?? null;
}
