"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { defaultCurrencyForCountry } from "@/lib/currency";
import { onboardingSchema, type OnboardingInput } from "@/schemas/onboarding";
import type { Database } from "@/types/database";

/**
 * Create a new organization during onboarding.
 * First user of a new org becomes club_president (D-05).
 *
 * The org + first membership + subscription are created atomically by the
 * SECURITY DEFINER RPC public.create_organization_onboarding (00014). RLS is
 * intentionally NOT relaxed: a brand-new user cannot satisfy the
 * membership_insert policy (which requires already being a president), so the
 * RPC performs the bootstrap on their behalf — but ONLY for the caller
 * (auth.uid()), ONLY as their first org, and ONLY with role club_president.
 */
export async function createOrganization(data: OnboardingInput) {
  // Validate input
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();

  // 1. Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Niste prijavljeni");
  }

  // 2. Check if user already has an organization (early, friendly error)
  const { data: existingMemberships } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existingMemberships && existingMemberships.length > 0) {
    throw new Error("Već imate kreiran klub");
  }

  // 3. Atomic org + membership + subscription creation via the RPC
  const { data: orgId, error: rpcError } = await supabase.rpc(
    "create_organization_onboarding",
    {
      p_name: parsed.data.club_name,
      p_sport: parsed.data.sport,
      p_country: parsed.data.country,
      p_language: parsed.data.language,
      // V1: one club currency; default from the country (RS -> RSD, else EUR).
      p_currency: defaultCurrencyForCountry(parsed.data.country),
      p_timezone: parsed.data.timezone,
    }
  );

  if (rpcError) {
    throw new Error("Greška pri kreiranju organizacije: " + rpcError.message);
  }

  if (!orgId) {
    throw new Error("Greška pri kreiranju organizacije");
  }

  // 4. Set JWT claims (organization_id, user_role) via the service-role admin
  //    client. Only the service role may write app_metadata. Every access check
  //    (middleware, requireOrganization, authorize(), RLS policies) reads these.
  const admin = createAuthAdminClient();
  const { error: claimsError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      organization_id: orgId,
      user_role: "club_president",
    },
  });

  if (claimsError) {
    throw new Error(
      "Klub je kreiran, ali aktivacija uloge nije uspela: " + claimsError.message
    );
  }

  // 5. Rotate the session so the fresh access token carries the new claims.
  //    RLS org-scoping (auth.jwt()->'app_metadata') reads the token, not the
  //    cached user object, so without this the club pages would appear empty.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.refresh_token) {
    const { error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: sessionData.session.refresh_token,
    });
    if (refreshError) {
      throw new Error(
        "Klub je kreiran, ali sesija nije osvežena: " + refreshError.message
      );
    }
  }

  revalidatePath("/sr");
  redirect("/sr");
}

function createAuthAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    throw new Error(
      "Kreiranje kluba zahteva podešen server-side Supabase admin ključ"
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}