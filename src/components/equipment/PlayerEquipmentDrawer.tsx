"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Drawer } from "@/components/ui/Drawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { MutationForm } from "@/components/ui/MutationForm";
import { IssuePlayerItemForm, type IssuePlayerItem } from "./IssuePlayerItemForm";
import { formatClubAthleteNumber } from "@/lib/athlete-id";

export interface EquipmentDrawerAssignment {
  item_id: string;
  state: string;
  size_top: string | null;
  size_bottom: string | null;
  number: string | null;
  issued_at: string | null;
  note: string | null;
}

export interface EquipmentDrawerPlayer {
  athlete_id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  jersey_number: number | null;
  team_name: string | null;
  sizes: Array<{ label: string; value: string | null }>;
  /** One-line sizes summary for the roster table. */
  sizesCompact: string;
  assignments: EquipmentDrawerAssignment[];
  summary: {
    hasRequirements: boolean;
    missingLabels: string[];
    issuedCount: number;
    missingCount: number;
    lostDamagedCount: number;
    complete: boolean;
  };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : format(date, "dd.MM.yyyy");
}

/**
 * Player equipment detail: read-only profile sizes, what is missing for the
 * team, current assignments with the return/lost/damaged lifecycle, and the
 * single "issue equipment" flow. Sizes are edited on the player profile, never
 * here. Delete is reserved for cleaning up an erroneous record (confirmation
 * + equipment.manage).
 */
export function PlayerEquipmentDrawer({
  open,
  onClose,
  player,
  items,
  canReport,
  canManage,
  issueAction,
  transitionAction,
  deleteAction,
}: {
  open: boolean;
  onClose: () => void;
  player: EquipmentDrawerPlayer | null;
  items: IssuePlayerItem[];
  canReport: boolean;
  canManage: boolean;
  issueAction: (formData: FormData) => Promise<unknown>;
  transitionAction: (formData: FormData) => Promise<unknown>;
  deleteAction: (formData: FormData) => Promise<unknown>;
}) {
  const t = useTranslations("equipment");
  const tf = useTranslations("feedback");
  const [issueOpen, setIssueOpen] = useState(false);

  if (!player) return null;

  const itemById = new Map(items.map((item) => [item.id, item]));
  const issuedItemIds = new Set(
    player.assignments
      .filter((assignment) => assignment.state === "issued")
      .map((assignment) => assignment.item_id)
  );
  const availableItems = items.filter((item) => !issuedItemIds.has(item.id));
  const activeAssignments = player.assignments.filter(
    (assignment) => assignment.state !== "returned"
  );

  const subtitle = [
    player.team_name,
    player.jersey_number ? `#${player.jersey_number}` : null,
    formatClubAthleteNumber(player.club_athlete_number),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${player.last_name} ${player.first_name}`}
      subtitle={subtitle}
      closeLabel={t("cancel")}
      size="lg"
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("sizesTitle")}
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {player.sizes.map((size) => (
              <div
                key={size.label}
                className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm"
              >
                <dt className="text-muted-foreground">{size.label}</dt>
                <dd className="font-medium text-foreground">
                  {size.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {player.summary.hasRequirements ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("missingTitle")}
            </h3>
            {player.summary.missingLabels.length === 0 ? (
              <p className="mt-2 text-sm text-success">
                {t("allRequirementsMet")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {player.summary.missingLabels.map((label) => (
                  <li key={label}>
                    <StatusBadge
                      tone="yellow"
                      dot={false}
                      label={label}
                      className="border-warning/30"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            {t("noRequirements")}
          </p>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("assignedTitle")}
            </h3>
            {canReport && !issueOpen && (
              <button
                type="button"
                onClick={() => setIssueOpen(true)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("issue")}
              </button>
            )}
          </div>

          {issueOpen && (
            <div className="mt-2">
              <IssuePlayerItemForm
                action={issueAction}
                athleteId={player.athlete_id}
                items={availableItems}
                jerseyNumber={player.jersey_number}
                onDone={() => setIssueOpen(false)}
              />
            </div>
          )}

          {activeAssignments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("noIssuedEquipment")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activeAssignments.map((assignment) => {
                const item = itemById.get(assignment.item_id);
                if (!item) return null;
                const sizeText = [assignment.size_top, assignment.size_bottom]
                  .filter(Boolean)
                  .join(" / ");
                const issuedOn = formatDate(assignment.issued_at);
                return (
                  <li
                    key={assignment.item_id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[
                            sizeText || null,
                            assignment.number
                              ? `${t("numberLabel")} ${assignment.number}`
                              : null,
                            t(`states.${assignment.state}`),
                            issuedOn ? t("issuedOn", { date: issuedOn }) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {assignment.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {assignment.note}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canReport && assignment.state === "issued" && (
                          <>
                            {(
                              [
                                ["returned", tf("equipmentReturned")],
                                ["lost", tf("equipmentStateChanged")],
                                ["damaged", tf("equipmentStateChanged")],
                              ] as const
                            ).map(([nextState, successMessage]) => (
                              <MutationForm
                                key={nextState}
                                action={transitionAction}
                                successMessage={successMessage}
                                errorMessage={tf("equipmentFailed")}
                              >
                                <input
                                  type="hidden"
                                  name="athlete_id"
                                  value={player.athlete_id}
                                />
                                <input
                                  type="hidden"
                                  name="item_id"
                                  value={item.id}
                                />
                                <input
                                  type="hidden"
                                  name="state"
                                  value={nextState}
                                />
                                <FormSubmitButton
                                  idleLabel={t(`actions.${nextState}`)}
                                  pendingLabel={t("saving")}
                                  className="rounded border border-border px-2 py-1 text-xs hover:border-primary"
                                />
                              </MutationForm>
                            ))}
                          </>
                        )}
                        {canManage && (
                          <ConfirmDeleteButton
                            action={deleteAction}
                            successMessage={tf("itemDeleted")}
                            errorMessage={tf("deleteFailed")}
                            hiddenFields={{
                              athlete_id: player.athlete_id,
                              item_id: item.id,
                            }}
                            triggerLabel={t("deleteErroneous")}
                            triggerClassName="rounded border border-destructive/60 px-2 py-1 text-xs text-destructive"
                            title={t("deleteConfirmTitle")}
                            body={t("deleteConfirmBody", { name: item.name })}
                            confirmLabel={t("deleteConfirm")}
                            cancelLabel={t("cancel")}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}
