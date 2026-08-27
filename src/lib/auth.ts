import { createServerClient } from "@/lib/supabase/server";

/**
 * Get the current authenticated user's session.
 */
export async function getSession() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current authenticated user.
 */
export async function getUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
