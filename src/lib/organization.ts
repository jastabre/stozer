import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { AppRole, AppPermission } from "@/types/database";

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
 * Require a valid organization context. Redirects to appropriate page
 * if user is not authenticated or has no organization.
 */
export async function requireOrganization(): Promise<OrganizationContext> {
  const ctx = await getOrganizationContext();

  if (!ctx) {
    // Check if user is authenticated at all
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // User is authenticated but has no org
    redirect("/sr/onboarding");
  }

  return ctx;
}

/**
 * Check if user has a specific permission.
 * Uses the authorize() PostgreSQL function via RLS.
 */
export async function hasPermission(permission: AppPermission): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("authorize", {
    p: permission,
  });

  if (error) return false;
  return data === true;
}

/**
 * Require a specific permission. Redirects if user lacks the permission.
 */
export async function requirePermission(permission: AppPermission): Promise<void> {
  const allowed = await hasPermission(permission);
  if (!allowed) {
    redirect("/sr/dashboard");
  }
}

/**
 * Refresh the session to get fresh JWT claims.
 * Useful after role changes or membership updates.
 */
export async function refreshSession(): Promise<boolean> {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.getSession();
  return !error;
}

/**
 * Get the user's effective role, with fallback to club_president.
 */
export async function getUserRole(): Promise<AppRole> {
  const ctx = await getOrganizationContext();
  return ctx?.userRole || "club_president";
}
