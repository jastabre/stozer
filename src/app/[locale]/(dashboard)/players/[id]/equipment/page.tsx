import { redirect } from "next/navigation";

/**
 * Legacy player-equipment route. The read-only equipment summary lives on the
 * player profile and the operational workflow in Oprema → Oprema igrača, so
 * old links redirect instead of duplicating the UI (and never 404).
 */
export default async function PlayerEquipmentRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/equipment?tab=players`);
}
