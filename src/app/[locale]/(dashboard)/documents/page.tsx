import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/organization";

/**
 * The standalone "Dokumenti" section is gone: person documents live on the
 * player/staff profiles, and club-wide files live in Club -> Dokumenti kluba.
 * Keep the old URL working by pointing it at the new location.
 */
export default async function DocumentsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOrganization();
  redirect(`/${locale}/club/documents`);
}
