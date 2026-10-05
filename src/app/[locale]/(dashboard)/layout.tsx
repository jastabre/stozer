import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import { ClubTheme } from "@/components/club/ClubTheme";
import { getNavConfig } from "@/lib/rbac";
import type { AppRole } from "@/types/database";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orgId = user.app_metadata?.organization_id as string | undefined;

  if (!orgId) {
    redirect("/sr/onboarding");
  }

  // Translate nav labels server-side through the current locale so the
  // sidebar, top bar and bottom navigation always render in the active
  // language. getNavConfig() emits full keys ("navigation.home"), so resolve
  // them with the root namespace (getTranslations() with no argument).
  const role = (user.app_metadata?.user_role as AppRole) || "club_president";
  const t = await getTranslations();
  const navItems = getNavConfig(role).map((item) => ({
    ...item,
    label: t(item.label),
  }));

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name, primary_color, secondary_color, logo_url")
    .eq("id", orgId)
    .maybeSingle();
  const orgName = orgRow?.name || "STOŽER";

  const userInitials = (user.user_metadata?.full_name as string | undefined)
    ?.split(" ")
    .filter(Boolean)
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || (user.email ? user.email[0].toUpperCase() : "?");

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <ClubTheme primary={orgRow?.primary_color} />
      <AppShell
        navItems={navItems}
        orgName={orgName}
        logoUrl={orgRow?.logo_url}
        userEmail={user.email}
        userInitials={userInitials}
        logoutLabel={t("navigation.logout")}
        moreLabel={t("navigation.more")}
        closeLabel={t("navigation.close")}
      >
        {children}
      </AppShell>
    </div>
  );
}
