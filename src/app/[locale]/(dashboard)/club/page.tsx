import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrganization, requirePermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getOrganizationSettings, updateOrganizationSettings } from "@/lib/club-data";

const thresholdSchema = z
  .number({ coerce: true })
  .int()
  .min(1, "range")
  .max(730, "range");

export default async function ClubSettingsPage() {
  await requirePermission("club_settings.manage");
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("club");

  const settings = await getOrganizationSettings(supabase, org.organizationId);
  const threshold = settings?.warning_threshold_days ?? 30;

  async function saveThreshold(formData: FormData) {
    "use server";
    const org = await requireOrganization();
    const supabase = await createServerClient();
    await requirePermission("club_settings.manage");

    const parsed = thresholdSchema.safeParse(formData.get("warning_threshold_days"));
    if (!parsed.success) return;

    await updateOrganizationSettings(supabase, org.organizationId, parsed.data);
    revalidatePath("/club");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="max-w-xl space-y-6">
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold">{t("thresholdTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("thresholdDescription")}</p>
          <form action={saveThreshold} className="mt-4 flex items-end gap-3">
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
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t("save")}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold">{t("overviewTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("overviewDescription")}</p>
        </section>
      </div>
    </div>
  );
}
