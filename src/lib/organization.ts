import { createServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export interface OrganizationContext {
  organizationId: string;
  userRole: AppRole;
  userId: string;
}

/**
 * Get the current user's organization context from JWT claims.
 * Server-side only — reads from session/JWT.
 */
export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const organizationId = user.app_metadata?.organization_id;
  const userRole = user.app_metadata?.user_role as AppRole;

  if (!organizationId || !userRole) return null;

  return {
    organizationId,
    userRole,
    userId: user.id,
  };
}

/**
 * Require a valid organization context. Throws if user is not authenticated
 * or has no organization.
 */
export async function requireOrganization(): Promise<OrganizationContext> {
  const ctx = await getOrganizationContext();
  if (!ctx) {
    throw new Error("Unauthorized: no valid organization context");
  }
  return ctx;
}
