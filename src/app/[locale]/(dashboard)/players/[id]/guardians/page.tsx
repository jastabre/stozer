import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAthleteWithMemberships } from "@/lib/club-data";
import { listGuardians } from "@/lib/guardian";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { addGuardianAction, deleteGuardianAction, saveGuardiansAction } from "./actions";

const contactMethods = ["phone", "email", "sms", "other"] as const;
const inputClass = "rounded-lg border px-3 py-2 text-sm";

export default async function GuardiansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const [canViewAthletes, canViewStaff, canEdit, athlete, guardians, t] = await Promise.all([
    hasPermission("athletes.view"),
    hasPermission("staff.view"),
    hasPermission("athletes.edit"),
    getAthleteWithMemberships(supabase, org.organizationId, id),
    listGuardians(supabase, org.organizationId, id),
    getTranslations("players.guardians"),
  ]);
  if ((!canViewAthletes && !canViewStaff) || !athlete) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/players/${id}`} className="text-sm text-primary hover:underline">← {t("back")}</Link>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{athlete.last_name} {athlete.first_name}</p>
      </div>
      <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{t("description")}</p>

      <section className="rounded-xl border border-border p-5">
        {guardians.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : <form action={saveGuardiansAction} className="space-y-4"><input type="hidden" name="athlete_id" value={id} />{guardians.map((guardian) => <div key={guardian.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]"><input type="hidden" name="guardian_id" value={guardian.id} /><input name="full_name" defaultValue={guardian.full_name} aria-label={t("name")} disabled={!canEdit} required className={inputClass} /><input name="relationship" defaultValue={guardian.relationship} aria-label={t("relationship")} disabled={!canEdit} required className={inputClass} /><input name="phone" defaultValue={guardian.phone ?? ""} type="tel" aria-label={t("phone")} disabled={!canEdit} className={inputClass} /><input name="email" defaultValue={guardian.email ?? ""} type="email" aria-label={t("email")} disabled={!canEdit} className={inputClass} /><div className="flex items-center gap-2 text-xs"><label className="flex items-center gap-1"><input type="radio" name="primary_id" value={guardian.id} defaultChecked={guardian.is_primary} disabled={!canEdit} />{t("primary")}</label><select name="preferred_contact" defaultValue={guardian.preferred_contact ?? ""} aria-label={t("preferredContact")} disabled={!canEdit} className="rounded border px-2 py-1"><option value="">—</option>{contactMethods.map((method) => <option key={method} value={method}>{t(`contactMethods.${method}`)}</option>)}</select>{canEdit && <button formAction={deleteGuardianAction} name="delete_guardian_id" value={guardian.id} className="text-destructive hover:underline">{t("delete")}</button>}</div></div>)}{canEdit && <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{t("save")}</button>}</form>}
      </section>

      {canEdit && <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">{t("add")}</h2><form action={addGuardianAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="athlete_id" value={id} /><input name="full_name" placeholder={t("name")} required className={inputClass} /><input name="relationship" placeholder={t("relationship")} required className={inputClass} /><input name="phone" type="tel" placeholder={t("phone")} className={inputClass} /><input name="email" type="email" placeholder={t("email")} className={inputClass} /><select name="preferred_contact" defaultValue="" aria-label={t("preferredContact")} className={inputClass}><option value="">{t("preferredContact")}</option>{contactMethods.map((method) => <option key={method} value={method}>{t(`contactMethods.${method}`)}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_primary" value="true" />{t("primary")}</label><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2">{t("add")}</button></form></section>}
    </div>
  );
}
