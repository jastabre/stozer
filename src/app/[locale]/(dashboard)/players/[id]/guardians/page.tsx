import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { differenceInCalendarYears } from "date-fns";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { loadGuardians, loadPlayerShell } from "@/lib/player-profile";
import { addGuardianAction, deleteGuardianAction, editGuardianAction } from "./actions";
import {
  GuardianForm,
  type GuardianFormLabels,
  type RelationshipOption,
} from "@/components/players/GuardianForm";
import { GuardianAdd } from "@/components/players/GuardianAdd";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

const RELATIONSHIP_PRESETS = ["father", "mother", "guardian"] as const;

export default async function GuardiansPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  await requireOrganization();

  const [canView, canEdit, athlete, guardians] = await Promise.all([
    hasPermission("athletes.view"),
    hasPermission("athletes.edit"),
    loadPlayerShell(id).then((r) => r.athlete),
    loadGuardians(id),
  ]);
  if (!canView || !athlete) notFound();

  // The tab exists for minors or whenever guardian data already exists — never
  // purely by team category. An adult with no records has nothing to see here.
  const age = athlete.birth_date
    ? differenceInCalendarYears(new Date(), new Date(athlete.birth_date))
    : null;
  const isMinor = age != null && age < 18;
  if (!isMinor && guardians.length === 0) notFound();

  const t = await getTranslations("players.guardians");
  const tf = await getTranslations("feedback");

  const relationshipOptions: RelationshipOption[] = RELATIONSHIP_PRESETS.map(
    (k) => ({
      value: t(`relationships.${k}`),
      label: t(`relationships.${k}`),
    })
  );

  const labels = (mode: "add" | "edit"): GuardianFormLabels => ({
    name: t("name"),
    namePlaceholder: t("namePlaceholder"),
    relationship: t("relationship"),
    relationshipPlaceholder: t("relationshipSelectPlaceholder"),
    relationshipOptions,
    phone: t("phone"),
    email: t("email"),
    save: mode === "add" ? t("add") : t("save"),
    saving: mode === "add" ? t("adding") : t("saving"),
    needContact: t("needContact"),
  });

  const header = (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("description")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <GuardianAdd
        canEdit={canEdit}
        hasGuardians={guardians.length > 0}
        action={addGuardianAction}
        athleteId={id}
        labels={labels("add")}
        emptyLabel={t("none")}
        header={header}
      />

      {guardians.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {guardians.map((g) => {
              const contacts = [g.phone, g.email].filter(Boolean) as string[];
              return (
                <li key={g.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{g.full_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.relationship}
                      </p>
                      {contacts.length > 0 && (
                        <p className="mt-1 text-sm tabular-nums text-foreground">
                          {contacts.join(" · ")}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-3">
                        <details className="group/edit">
                          <summary className="cursor-pointer list-none text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                            {t("edit")}
                          </summary>
                          <div className="mt-3 w-screen max-w-md rounded-lg border border-border bg-card p-4">
                            <GuardianForm
                              action={editGuardianAction}
                              athleteId={id}
                              guardianId={g.id}
                              initial={{
                                id: g.id,
                                full_name: g.full_name,
                                relationship: g.relationship,
                                phone: g.phone ?? "",
                                email: g.email ?? "",
                                preferred_contact: g.preferred_contact,
                                is_primary: g.is_primary,
                              }}
                              labels={labels("edit")}
                            />
                          </div>
                        </details>
                        <ConfirmDeleteButton
                          action={deleteGuardianAction}
                          hiddenFields={{ guardian_id: g.id, athlete_id: id }}
                          triggerLabel={t("delete")}
                          triggerClassName="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                          title={t("deleteConfirmTitle")}
                          body={t("deleteConfirmBody")}
                          confirmLabel={t("deleteConfirm")}
                          cancelLabel={t("cancel")}
                          pendingLabel={t("deleting")}
                          successMessage={tf("itemDeleted")}
                          errorMessage={tf("deleteFailed")}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
