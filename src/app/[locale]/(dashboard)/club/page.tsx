import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  hasPermission,
  requireOrganization,
  requirePermission,
} from "@/lib/organization";
import { buildClubTabs } from "@/lib/club-nav";
import { createServerClient } from "@/lib/supabase/server";
import {
  getActiveSeason,
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/lib/club-data";
import { ProfileTabs } from "@/components/ui/ProfileTabs";
import { LogoUploader } from "@/components/club/LogoUploader";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  saveBrandingAction,
  uploadLogoAction,
  removeLogoAction,
} from "./actions";

const thresholdSchema = z
  .number({ coerce: true })
  .int()
  .min(1, "range")
  .max(730, "range");

export default async function ClubSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // The Club section now hosts three areas with independent permissions. A
  // caller without club_settings.manage still belongs to the section when they
  // can manage documents or users, so send them to the first tab they can open
  // instead of bouncing them out.
  if (!(await hasPermission("club_settings.manage"))) {
    const [canUsers, canDocuments, canFacilities] = await Promise.all([
      hasPermission("users.manage"),
      hasPermission("documents.view"),
      hasPermission("venue.view"),
    ]);
    if (canDocuments) redirect(`/${locale}/club/documents`);
    if (canUsers) redirect(`/${locale}/club/users`);
    if (canFacilities) redirect(`/${locale}/club/facilities`);
    redirect(`/${locale}`);
  }
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("club");
  const tf = await getTranslations("feedback");

  const [tabs, settings, activeSeason, orgRow] = await Promise.all([
    buildClubTabs(locale, {
      settings: t("tabs.settings"),
      users: t("tabs.users"),
      documents: t("tabs.documents"),
      facilities: t("tabs.facilities"),
    }),
    getOrganizationSettings(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
    supabase
      .from("organizations")
      .select("name, logo_url, primary_color, secondary_color")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((r) => r.data),
  ]);
  const threshold = settings?.warning_threshold_days ?? 30;

  async function saveThreshold(formData: FormData) {
    "use server";
    const org = await requireOrganization();
    const supabase = await createServerClient();
    await requirePermission("club_settings.manage");

    const parsed = thresholdSchema.safeParse(formData.get("warning_threshold_days"));
    if (!parsed.success) {
      return { error: "Unesite broj dana između 1 i 730." };
    }

    const result = await updateOrganizationSettings(
      supabase,
      org.organizationId,
      parsed.data
    );
    if ("error" in result) {
      return { error: "Nije moguće sačuvati podešavanja. Pokušajte ponovo." };
    }
    revalidatePath("/club");
    return { ok: true };
  }

  return (
    <div className="space-y-6">
      <ProfileTabs label={t("tabs.label")} items={tabs} />

      <PageHeader title={t("title")} />

      <div className="max-w-xl space-y-6">
        {/* Season lives with club settings (not app Settings, not the sidebar).
            Single active season → a compact entry point to the seasons screen. */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">{t("seasonTitle")}</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-base font-medium text-foreground">
                {activeSeason ? activeSeason.name : t("noActiveSeason")}
              </p>
              {activeSeason?.starts_on && (
                <p className="text-sm text-muted-foreground">
                  {t("seasonStarts", { date: activeSeason.starts_on })}
                </p>
              )}
            </div>
            <Link
              href={`/${locale}/seasons`}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("manageSeason")}
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">{t("thresholdTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("thresholdDescription")}</p>
          <MutationForm
            action={saveThreshold}
            successMessage={tf("clubSettingsSaved")}
            errorMessage={tf("saveFailed")}
            className="mt-4 flex items-end gap-3"
          >
            <label className="flex flex-col text-xs text-muted-foreground">
              {t("thresholdLabel")}
              <input
                type="number"
                name="warning_threshold_days"
                min={1}
                max={730}
                defaultValue={threshold}
                required
                className="mt-1 w-32 rounded-lg border px-3 py-2 text-sm text-foreground"
              />
            </label>
            <FormSubmitButton
              idleLabel={t("save")}
              pendingLabel={t("saving")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </MutationForm>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">{t("branding.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("branding.description")}</p>

          <div className="mt-4 rounded-lg border border-border p-4">
            <p className="mb-3 text-xs text-muted-foreground">{t("branding.logo")}</p>
            <LogoUploader
              currentUrl={orgRow?.logo_url ?? null}
              uploadAction={uploadLogoAction}
              removeAction={removeLogoAction}
              uploadLabel={t("branding.logoUpload")}
              uploadingLabel={t("branding.uploading")}
              removeLabel={t("branding.removeLogo")}
              removingLabel={t("branding.removing")}
              chooseLabel={t("branding.chooseLogo")}
              changeLabel={t("branding.changeLogo")}
              hint={t("branding.logoHint")}
            />
          </div>

          <MutationForm
            action={saveBrandingAction}
            successMessage={tf("brandingSaved")}
            errorMessage={tf("saveFailed")}
            className="mt-4 grid gap-3"
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("branding.primaryColor")}
              <span className="flex items-center gap-2">
                <input
                  name="primary_color"
                  type="color"
                  defaultValue={orgRow?.primary_color ?? "#2563eb"}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1"
                />
                <span className="font-mono text-sm text-foreground">
                  {orgRow?.primary_color ?? "#2563eb"}
                </span>
              </span>
            </label>
            <FormSubmitButton
              idleLabel={t("branding.save")}
              pendingLabel={t("saving")}
              className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            />
          </MutationForm>
        </section>
      </div>
    </div>
  );
}
