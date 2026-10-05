import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOrganization, requirePermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { listTeams } from "@/lib/club-data";
import {
  listEquipmentItems,
  listTeamEquipmentRequirements,
} from "@/lib/equipment";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs } from "@/components/ui/SectionTabs";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { TeamFilter } from "@/components/teams/TeamFilter";
import { EquipmentItemDialog } from "@/components/equipment/EquipmentItemDialog";
import {
  createEquipmentItemAction,
  deleteEquipmentItemAction,
  saveTeamRequirementsAction,
  updateEquipmentItemAction,
} from "../actions";

const SETTINGS_TABS = ["articles", "requirements"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function settingsHref(tab: SettingsTab, teamId?: string) {
  const params = new URLSearchParams({ tab });
  if (teamId) params.set("team", teamId);
  return params.toString();
}

/**
 * Equipment settings — configuration split into two internal tabs so each
 * screen stays short: catalog articles and per-team required equipment. These
 * are NOT main Equipment tabs; the operational screen keeps Oprema igrača /
 * Trening rekviziti / Zahtevi. Article setup owns its size mode, so the
 * internal piece presets are no longer administered from the daily UI.
 */
export default async function EquipmentSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requirePermission("equipment.manage");
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("equipment");
  const tf = await getTranslations("feedback");

  const activeTab: SettingsTab = SETTINGS_TABS.includes(sp.tab as SettingsTab)
    ? (sp.tab as SettingsTab)
    : "articles";

  const [items, teams] = await Promise.all([
    listEquipmentItems(supabase, org.organizationId),
    listTeams(supabase, org.organizationId),
  ]);

  const selectedTeamId =
    sp.team && teams.some((team) => team.id === sp.team)
      ? sp.team
      : teams[0]?.id;

  const requirements =
    activeTab === "requirements" && selectedTeamId
      ? await listTeamEquipmentRequirements(
          supabase,
          org.organizationId,
          selectedTeamId
        )
      : [];
  const requiredItemIds = new Set(requirements.map((row) => row.item_id));
  const sizeModeLabel = (mode: string): string =>
    mode === "single"
      ? t("sizeModeSingle")
      : mode === "split"
        ? t("sizeModeSplit")
        : t("sizeNone");

  return (
    <div className="space-y-5">
      <Link
        href={`/${locale}/equipment?tab=players`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        ← {t("settingsBack")}
      </Link>

      <PageHeader title={t("settingsTitle")} description={t("settingsDescription")} />

      <SectionTabs
        label={t("settingsButton")}
        activeHref={`/${locale}/equipment/settings?${settingsHref(
          activeTab,
          activeTab === "requirements" ? selectedTeamId : undefined
        )}`}
        items={[
          {
            href: `/${locale}/equipment/settings?tab=articles`,
            label: t("settingsTabs.articles"),
          },
          {
            href: `/${locale}/equipment/settings?${settingsHref("requirements", selectedTeamId)}`,
            label: t("settingsTabs.requirements"),
          },
        ]}
      />

      {activeTab === "articles" && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{t("catalogTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("catalogDescription")}
              </p>
            </div>
            <EquipmentItemDialog
              mode="create"
              createAction={createEquipmentItemAction}
              updateAction={updateEquipmentItemAction}
            />
          </div>

          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noCatalogItems")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {items.map((item) => {
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sizeModeLabel(item.size_mode)}
                        {item.has_number ? ` · ${t("hasNumber")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <EquipmentItemDialog
                        mode="edit"
                        item={item}
                        createAction={createEquipmentItemAction}
                        updateAction={updateEquipmentItemAction}
                      />
                      <ConfirmDeleteButton
                        action={deleteEquipmentItemAction}
                        successMessage={tf("itemDeleted")}
                        errorMessage={tf("deleteFailed")}
                        hiddenFields={{ item_id: item.id }}
                        triggerLabel={t("delete")}
                        triggerClassName="rounded-lg border border-destructive/60 px-2.5 py-1 text-xs font-medium text-destructive"
                        title={t("deleteConfirmTitle")}
                        body={t("deleteConfirmBody", { name: item.name })}
                        confirmLabel={t("deleteConfirm")}
                        cancelLabel={t("cancel")}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {activeTab === "requirements" && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">{t("teamRequirements")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("requirementsDescription")}
          </p>

          {teams.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noTeams")}</p>
          ) : (
            <>
              <TeamFilter
                teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                selectedTeamId={selectedTeamId ?? null}
                teamHref={(teamId) =>
                  `/${locale}/equipment/settings?${settingsHref("requirements", teamId)}`
                }
                ariaLabel={t("team")}
                label={t("team")}
                tone="soft"
                className="mt-3"
              />
              <MutationForm
                action={saveTeamRequirementsAction}
                successMessage={tf("changesSaved")}
                errorMessage={tf("saveFailed")}
                className="mt-3 grid gap-2"
              >
                <input type="hidden" name="team_id" value={selectedTeamId ?? ""} />
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((item) => {
                    return (
                      <label
                        key={item.id}
                        className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="item_id"
                          value={item.id}
                          defaultChecked={requiredItemIds.has(item.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">
                            {item.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {sizeModeLabel(item.size_mode)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FormSubmitButton
                  idleLabel={t("saveRequirements")}
                  pendingLabel={t("saving")}
                  className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                />
              </MutationForm>
            </>
          )}
        </section>
      )}
    </div>
  );
}
