import { getTranslations } from "next-intl/server";
import {
  hasPermission,
  requireOrganization,
  requirePermission,
} from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { listVenues, VENUE_TYPES, type VenueType } from "@/lib/venue";
import { PageHeader } from "@/components/ui/PageHeader";
import { MutationForm } from "@/components/ui/MutationForm";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { createVenueAction, updateVenueAction } from "./actions";

const fieldClass =
  "rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

export default async function FacilitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  await requirePermission("venue.view");

  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("facilities");
  const tf = await getTranslations("feedback");

  const venues = await listVenues(supabase, org.organizationId);
  const canManage = await hasPermission("venue.manage");

  const typeLabel = (value: VenueType) => t(`types.${value}`);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {canManage && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">{t("add")}</h2>
          <MutationForm
            action={createVenueAction}
            successMessage={t("saved")}
            errorMessage={tf("saveFailed")}
            className="mt-3 space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="name"
                required
                maxLength={120}
                placeholder={t("name")}
                className={fieldClass}
              />
              <select name="venue_type" className={fieldClass}>
                {VENUE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {typeLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <input
              name="address"
              placeholder={t("address")}
              className={`w-full ${fieldClass}`}
            />
            <input
              name="note"
              placeholder={t("note")}
              className={`w-full ${fieldClass}`}
            />
            <FormSubmitButton
              idleLabel={t("save")}
              pendingLabel={t("saving")}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            />
          </MutationForm>
        </section>
      )}

      {venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {venues.map((venue) => (
            <li
              key={venue.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{venue.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {typeLabel(venue.venue_type)}
                    {venue.address ? ` · ${venue.address}` : ""}
                  </p>
                </div>
                {!venue.is_active && (
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {t("inactive")}
                  </span>
                )}
              </div>

              {canManage && (
                <MutationForm
                  action={updateVenueAction}
                  successMessage={t("saved")}
                  errorMessage={tf("saveFailed")}
                  className="mt-3 space-y-2 border-t border-border pt-3"
                >
                  <input type="hidden" name="venue_id" value={venue.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      name="name"
                      required
                      maxLength={120}
                      defaultValue={venue.name}
                      className={fieldClass}
                    />
                    <select
                      name="venue_type"
                      defaultValue={venue.venue_type}
                      className={fieldClass}
                    >
                      {VENUE_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {typeLabel(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    name="address"
                    defaultValue={venue.address ?? ""}
                    placeholder={t("address")}
                    className={`w-full ${fieldClass}`}
                  />
                  <input
                    name="note"
                    defaultValue={venue.note ?? ""}
                    placeholder={t("note")}
                    className={`w-full ${fieldClass}`}
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      name="is_active"
                      value="true"
                      defaultChecked={venue.is_active}
                    />
                    {t("active")}
                  </label>
                  <FormSubmitButton
                    idleLabel={t("save")}
                    pendingLabel={t("saving")}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  />
                </MutationForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
