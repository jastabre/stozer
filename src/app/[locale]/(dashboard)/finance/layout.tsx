import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasPermission } from "@/lib/organization";
import { buildFinanceTabs } from "@/lib/finance-nav";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileTabs } from "@/components/ui/ProfileTabs";

/**
 * The central Finansije shell: one header + tab bar for Pregled / Isplate
 * igrača / Isplate osoblja. A caller with any finance permission reaches the
 * section; tabs that the caller cannot open are omitted.
 */
export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const [canPlayers, canStaff] = await Promise.all([
    hasPermission("first_team_finance.view"),
    hasPermission("staff_finance.view"),
  ]);
  if (!canPlayers && !canStaff) notFound();

  const t = await getTranslations("finance");
  const tabs = buildFinanceTabs(
    locale,
    {
      overview: t("tabs.overview"),
      players: t("tabs.players"),
      staff: t("tabs.staff"),
    },
    canPlayers,
    canStaff
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ProfileTabs label={t("tabs.label")} items={tabs} />
      {children}
    </div>
  );
}
