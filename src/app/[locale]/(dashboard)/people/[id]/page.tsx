import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getActiveSeason, getOrganizationSettings, listDocuments, listTeams } from "@/lib/club-data";
import { DocumentSection } from "@/components/documents/DocumentSection";
import { getStaffProfile } from "@/lib/staff";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  deleteStaffAction,
  deleteStaffLicenseAction,
  linkStaffAccountAction,
  saveStaffLicenseAction,
  saveStaffTeamsAction,
  updateStaffAction,
} from "../actions";
import type { AppRole } from "@/types/database";

const roles: AppRole[] = ["club_president", "youth_director", "coach", "admin_finance"];
const toneClasses = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
} as const;

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const [canView, canManage, canViewDocuments, canManageDocuments, settings, teams, activeSeason, t] = await Promise.all([
    hasPermission("staff.view"),
    hasPermission("staff.manage"),
    hasPermission("documents.view"),
    hasPermission("documents.manage"),
    getOrganizationSettings(supabase, org.organizationId),
    listTeams(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
    getTranslations("people"),
  ]);
  if (!canView) notFound();
  const person = await getStaffProfile(
    supabase,
    org.organizationId,
    id,
    org,
    settings?.warning_threshold_days ?? 30
  );
  if (!person) notFound();
  const documents = canViewDocuments
    ? await listDocuments(supabase, org.organizationId, "staff", person.id)
    : [];

  const inputClass = "rounded-lg border px-3 py-2 text-sm";
  return (
    <div className="space-y-6">
      <div>
        <Link href="/people" className="text-sm text-primary hover:underline">← {t("back")}</Link>
        <h1 className="mt-1 text-2xl font-bold">{person.last_name} {person.first_name}</h1>
        <p className="text-sm text-muted-foreground">{person.title || t("notSet")}</p>
      </div>

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("profile")}</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">{t("phone")}</dt><dd>{person.phone || t("notSet")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("email")}</dt><dd>{person.email || t("notSet")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("startDate")}</dt><dd>{person.start_date || t("notSet")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("endDate")}</dt><dd>{person.end_date || t("notSet")}</dd></div>
        </dl>
        {person.notes && <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-muted-foreground">{person.notes}</p>}
      </section>

      {canManage && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold">{t("editProfile")}</h2>
          <form action={updateStaffAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="staff_id" value={person.id} />
            <input name="first_name" defaultValue={person.first_name} required className={inputClass} />
            <input name="last_name" defaultValue={person.last_name} required className={inputClass} />
            <input name="title" defaultValue={person.title ?? ""} placeholder={t("titleField")} className={inputClass} />
            <input name="email" type="email" defaultValue={person.email ?? ""} placeholder={t("email")} className={inputClass} />
            <input name="phone" type="tel" defaultValue={person.phone ?? ""} placeholder={t("phone")} className={inputClass} />
            <input name="photo_url" defaultValue={person.photo_url ?? ""} placeholder={t("photoUrl")} className={inputClass} />
            <label className="grid gap-1 text-xs text-muted-foreground">{t("startDate")}<input name="start_date" type="date" defaultValue={person.start_date ?? ""} className={inputClass} /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">{t("endDate")}<input name="end_date" type="date" defaultValue={person.end_date ?? ""} className={inputClass} /></label>
            <textarea name="notes" defaultValue={person.notes ?? ""} placeholder={t("notes")} className={`${inputClass} sm:col-span-2`} rows={3} />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2">{t("save")}</button>
          </form>
          <form action={deleteStaffAction} className="mt-3"><input type="hidden" name="staff_id" value={person.id} /><button type="submit" className="rounded-lg border border-destructive px-3 py-1.5 text-xs text-destructive">{t("delete")}</button></form>
        </section>
      )}

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("teams")}</h2>
        {person.teams.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{person.teams.map((team) => team.team_name).join(", ")}</p>}
        {canManage && activeSeason && (
          <form action={saveStaffTeamsAction} className="mt-4 grid gap-3">
            <input type="hidden" name="staff_id" value={person.id} />
            <input type="hidden" name="season_id" value={activeSeason.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              {teams.map((team) => <label key={team.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" name="team_id" value={team.id} defaultChecked={person.teams.some((assigned) => assigned.team_id === team.id)} />{team.name}</label>)}
            </div>
            <button type="submit" className="w-fit rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{t("saveTeams")}</button>
          </form>
        )}
        {!activeSeason && <p className="mt-2 text-sm text-muted-foreground">{t("noActiveSeason")}</p>}
      </section>

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("licenses")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("licenseHint")}</p>
        <div className="mt-4 space-y-3">
          {person.licenses.length === 0 && <p className="text-sm text-muted-foreground">{t("noLicenses")}</p>}
          {person.licenses.map((license) => <div key={license.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"><form action={saveStaffLicenseAction} className="flex min-w-0 flex-1 flex-wrap gap-2"><input type="hidden" name="staff_id" value={person.id} /><input type="hidden" name="id" value={license.id} /><input name="license_type" defaultValue={license.license_type} aria-label={t("licenseType")} className={`${inputClass} min-w-40`} /><input name="license_number" defaultValue={license.license_number ?? ""} aria-label={t("licenseNumber")} className={`${inputClass} min-w-32`} /><input name="valid_until" type="date" defaultValue={license.valid_until} aria-label={t("validUntil")} className={inputClass} />{canManage && <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">{t("save")}</button>}</form><span className={`rounded-full px-2 py-1 text-xs font-medium ${toneClasses[license.status ?? "red"]}`}>{t(`status.${license.status ?? "red"}`)}</span>{canManage && <form action={deleteStaffLicenseAction}><input type="hidden" name="staff_id" value={person.id} /><input type="hidden" name="license_id" value={license.id} /><button type="submit" className="text-xs text-destructive hover:underline">{t("delete")}</button></form>}</div>)}
        </div>
        {canManage && <form action={saveStaffLicenseAction} className="mt-4 grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-4"><input type="hidden" name="staff_id" value={person.id} /><input name="license_type" placeholder={t("licenseType")} required className={inputClass} /><input name="license_number" placeholder={t("licenseNumber")} className={inputClass} /><input name="valid_until" type="date" required aria-label={t("validUntil")} className={inputClass} /><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">{t("addLicense")}</button></form>}
      </section>

      {canViewDocuments && (
        <DocumentSection
          documents={documents}
          ownerType="staff"
          ownerId={person.id}
          thresholdDays={settings?.warning_threshold_days ?? 30}
          canManage={canManageDocuments}
          redirectPath={`/people/${person.id}`}
        />
      )}

      {canManage && <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">{t("account")}</h2><p className="mt-1 text-xs text-muted-foreground">{person.user_id ? t("linkedAccount") : t("unlinkedAccount")}</p><form action={linkStaffAccountAction} className="mt-4 grid gap-3 sm:grid-cols-3"><input type="hidden" name="staff_id" value={person.id} /><input name="account_email" type="email" placeholder={t("accountEmail")} required className={inputClass} /><select name="role" defaultValue={person.role ?? "coach"} className={inputClass}>{roles.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}</select><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{t("linkAccount")}</button></form></section>}
    </div>
  );
}
