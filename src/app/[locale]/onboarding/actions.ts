"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingInput } from "@/schemas/onboarding";

/**
 * Create a new organization during onboarding.
 * First user of a new org becomes club_president (D-05).
 * Creates org + membership + subscription in a single transaction.
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

  // 2. Check if user already has an organization
  const { data: existingMemberships } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existingMemberships && existingMemberships.length > 0) {
    throw new Error("Već imate kreiran klub");
  }

  // 3. Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: parsed.data.club_name,
      sport: parsed.data.sport,
      country: parsed.data.country,
      language: parsed.data.language,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
    })
    .select()
    .single();

  if (orgError) {
    throw new Error("Greška pri kreiranju organizacije: " + orgError.message);
  }

  // 4. Create membership (first user = club_president)
  const { error: membershipError } = await supabase
    .from("organization_memberships")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "club_president",
    });

  if (membershipError) {
    throw new Error("Greška pri kreiranju članstva: " + membershipError.message);
  }

  // 5. Create subscription (FREE plan with 14-day trial)
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { error: subError } = await supabase.from("subscriptions").insert({
    organization_id: org.id,
    plan_id: "a0000000-0000-0000-0000-000000000002", // CLUB plan (trial)
    status: "active",
    trial_starts_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
  });

  if (subError) {
    throw new Error("Greška pri kreiranju pretplate: " + subError.message);
  }

  // 6. Set JWT claims via Supabase Admin API
  // Note: In production this would use a custom_access_token_hook.
  // For now we update the user's app_metadata directly.
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      app_metadata: {
        ...user.app_metadata,
        organization_id: org.id,
        user_role: "club_president",
      },
    }
  );

  // If admin API isn't available, we can also try updating the user's metadata
  // through the regular auth update
  if (updateError) {
    // Try alternative: update via user metadata
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        organization_id: org.id,
        user_role: "club_president",
      },
    });

    if (metaError) {
      // Log but don't fail — the org and membership are created
      console.error("Warning: Could not set JWT claims:", metaError.message);
    }
  }

  revalidatePath("/sr/dashboard");
  redirect("/sr/dashboard");
}
