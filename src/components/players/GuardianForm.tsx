"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import {
  useMutationFeedback,
  type MutationState,
} from "@/components/ui/useMutationFeedback";
import { relationshipOptionsFor } from "@/lib/guardian";

export type RelationshipOption = { value: string; label: string };

export type GuardianFormLabels = {
  name: string;
  namePlaceholder: string;
  relationship: string;
  relationshipPlaceholder: string;
  relationshipOptions: RelationshipOption[]; // [{value:'Otac',label:'Otac'}, ...]
  phone: string;
  email: string;
  save: string;
  saving: string;
  needContact: string;
};

export type GuardianFormValue = {
  id?: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string;
  preferred_contact: "phone" | "email" | null;
  is_primary: boolean;
};

/**
 * Shared add/edit guardian form (V1): name, relationship (Otac/Majka/Staratelj),
 * phone and email — nothing else. At least one contact channel is required.
 * Preferred contact and the primary flag stay as hidden fields so existing
 * records are preserved without asking the user to decide.
 */
export function GuardianForm({
  action,
  athleteId,
  guardianId,
  initial,
  labels,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  athleteId: string;
  guardianId?: string;
  initial?: GuardianFormValue;
  labels: GuardianFormLabels;
  className?: string;
}) {
  const tf = useTranslations("feedback");
  const [name, setName] = useState(initial?.full_name ?? "");
  const [relationship, setRelationship] = useState(initial?.relationship ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [touched, setTouched] = useState(false);
  // Fields are controlled, so feedback comes from useMutationFeedback (not
  // MutationForm, whose reset-on-success would not clear controlled state).
  const [, formAction] = useMutationFeedback<MutationState>(
    async (_previous, formData) => {
      await action(formData);
      return { ok: true };
    },
    {
      successMessage: tf("guardianSaved"),
      errorMessage: tf("saveFailed"),
    }
  );

  const hasContact = !!phone.trim() || !!email.trim();
  // Keep a legacy stored relationship (e.g. "baka") selectable when editing so
  // an unrelated phone/email edit never forces the user to change it. New
  // guardians only ever get the standard options (initial is undefined).
  const options = relationshipOptionsFor(
    labels.relationshipOptions,
    initial?.relationship
  );

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        // Only this rule can't be expressed with `required` (both optional, at
        // least one needed). Native validation blocks empty name/relationship.
        if (!hasContact) {
          setTouched(true);
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="athlete_id" value={athleteId} />
      {guardianId && <input type="hidden" name="guardian_id" value={guardianId} />}
      {/* Internal-only fields: never surfaced, only carried through to preserve
          existing records (preferred contact, single-primary invariant). */}
      <input
        type="hidden"
        name="preferred_contact"
        value={initial?.preferred_contact ?? ""}
      />
      <input
        type="hidden"
        name="is_primary"
        value={initial?.is_primary ? "true" : ""}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.name}
          <input
            name="full_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={labels.namePlaceholder}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.relationship}
          <select
            name="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            required
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="" disabled>
              {labels.relationshipPlaceholder}
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.phone}
          <input
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.email}
          <input
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="off"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>

      {touched && !hasContact && (
        <p className="mt-2 text-xs text-destructive">{labels.needContact}</p>
      )}

      <div className="mt-4">
        <FormSubmitButton
          idleLabel={labels.save}
          pendingLabel={labels.saving}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        />
      </div>
    </form>
  );
}
