import { createServerClient } from "@/lib/supabase/server";

export interface EntitlementValue {
  key: string;
  value: number;
}

export async function checkEntitlement(
  orgId: string,
  key: string
): Promise<number | null> {
  const supabase = await createServerClient();

  // Get subscription -> plan
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, trial_ends_at")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .single();

  if (!sub) return null;

  // Check if trial has expired and plan is effectively FREE
  const isTrialActive =
    sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date();

  // Get entitlement for this key
  const { data: entitlement } = await supabase
    .from("plan_entitlements")
    .select("value")
    .eq("plan_id", sub.plan_id)
    .eq("key", key)
    .single();

  if (!entitlement) return null;

  return entitlement.value;
}

export async function isTrialActive(orgId: string): Promise<boolean> {
  const supabase = await createServerClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("trial_ends_at")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .single();

  if (!sub?.trial_ends_at) return false;
  return new Date(sub.trial_ends_at) > new Date();
}

export async function isFeatureLocked(
  orgId: string,
  featureKey: string
): Promise<boolean> {
  const supabase = await createServerClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, trial_ends_at")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .single();

  if (!sub) return true;

  // Check trial status
  const isTrialActive =
    sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date();

  // Get the FREE plan ID
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id")
    .eq("name", "FREE")
    .single();

  // If on FREE plan and trial expired, features are locked
  if (sub.plan_id === freePlan?.id && !isTrialActive) {
    // Check if this feature is a premium one (value > 1 or is a restricted entitlement)
    const { data: entitlement } = await supabase
      .from("plan_entitlements")
      .select("value")
      .eq("plan_id", sub.plan_id)
      .eq("key", featureKey)
      .single();

    // If FREE plan has a low limit, feature is locked
    return entitlement ? entitlement.value <= 1 : true;
  }

  return false;
}
