import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { differenceInCalendarYears } from "date-fns";
import { hasPermission } from "@/lib/organization";
import { shouldShowGuardiansTab } from "@/lib/guardian";
import {
  loadGuardianCount,
  loadLinkedStaff,
  loadPlayerShell,
} from "@/lib/player-profile";
import { formatClubAthleteNumber } from "@/lib/athlete-id";
import { staffFunctionLabel } from "@/lib/staff-functions";
import { getAvatarSignedUrl } from "@/lib/storage";
import { ProfileTabs } from "@/components/ui/ProfileTabs";
import { AthletePhoto } from "@/components/players/AthletePhoto";
import { uploadAthletePhoto, removeAthletePhoto } from "./photo-actions";

/**
 * The persistent player-profile shell. Every player tab renders inside it, so
 * the back link, player identity header and tab navigation stay put while only
 * the active tab's content swaps — switching tabs never feels like leaving the
 * player. The shell reads its data through `loadPlayerShell` (per-request
 * cached), so it does not re-query on client-side tab navigation.
 */
export default async function PlayerProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const [canViewAthlete, canViewReg, canViewMedical, canViewContracts, canViewStaff, canViewDocuments, canEditAthlete] =
    await Promise.all([
      hasPermission("athletes.view"),
      hasPermission("registrations.view"),
      Promise.all([hasPermission("medical.view"), hasPermission("registrations.view")]).then(
        ([m, r]) => m || r
      ),
      hasPermission("contracts.view"),
      hasPermission("staff.view"),
      hasPermission("documents.view"),
      hasPermission("athletes.edit"),
    ]);
  if (!canViewAthlete) notFound();

  const { org, supabase, athlete, teams } = await loadPlayerShell(id);
  if (!athlete) notFound();

  const t = await getTranslations("players.profile");
  const tf = await getTranslations("feedback");
  const tc = await getTranslations("common");
  const uiLocale: "sr" | "en" = locale === "en" ? "en" : "sr";
  const linkedStaff = canViewStaff ? await loadLinkedStaff(id) : null;
  const linkedStaffFunctions = linkedStaff
    ? linkedStaff.functions
        .map((fn) =>
          staffFunctionLabel(fn.function_key, uiLocale, fn.custom_label)
        )
        .join(" + ")
    : "";

  const current = athlete.memberships.find((m) => m.isActive) ?? null;
  const currentTeam = current
    ? teams.find((team) => team.id === current.teamId)
    : undefined;
  const isFirstTeam = currentTeam?.category === "first_team";

  // Player photo: athletes.photo_url stores the private storage path; the header
  // renders a fresh server-side signed URL (never persisted).
  const photoUrl = athlete.photo_url
    ? await getAvatarSignedUrl(supabase, org.organizationId, athlete.photo_url).catch(
        () => null
      )
    : null;

  const ageOf = (birthDate: string) =>
    differenceInCalendarYears(new Date(), new Date(birthDate));

  // Guardians belong to minors, not to a team category: show the tab for an
  // under-18 player, or whenever guardian records already exist (so historical
  // data for a now-adult player stays reachable and is never hidden).
  const isMinor = athlete.birth_date ? ageOf(athlete.birth_date) < 18 : false;
  const guardianCount = await loadGuardianCount(id);
  const showGuardians = shouldShowGuardiansTab({
    canView: canViewStaff,
    isMinor,
    guardianCount,
  });

  const identityParts = [
    current?.teamName ?? t("noTeamAssign"),
    current?.jerseyNumber ? `#${current.jerseyNumber}` : "",
    athlete.position ?? "",
    athlete.birth_date ? `${ageOf(athlete.birth_date)} ${t("ageSuffix")}` : "",
  ].filter(Boolean);

  const profileHref = `/${locale}/players/${athlete.id}`;
  const tabs = [
    { href: profileHref, label: t("overview") },
    ...(canViewReg
      ? [{ href: `${profileHref}/registrations`, label: t("sections.registrationsCompetition") }]
      : []),
    ...(canViewMedical
      ? [{ href: `${profileHref}/medical`, label: t("sections.medical") }]
      : []),
    ...(isFirstTeam && canViewContracts
      ? [{ href: `${profileHref}/contracts`, label: t("sections.contracts") }]
      : []),
    ...(showGuardians
      ? [{ href: `${profileHref}/guardians`, label: t("sections.guardians") }]
      : []),
    ...(canViewDocuments
      ? [{ href: `${profileHref}/documents`, label: t("sections.documents") }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/players`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        ← {t("back")}
      </Link>

      {/* Player identity — one shared header for every tab. */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <AthletePhoto
              athleteId={athlete.id}
              photoUrl={photoUrl}
              initials={`${athlete.first_name.charAt(0)}${athlete.last_name.charAt(0)}`}
              canEdit={canEditAthlete}
              uploadAction={uploadAthletePhoto}
              removeAction={removeAthletePhoto}
              labels={{
                add: t("photoAdd"),
                change: t("photoChange"),
                remove: t("photoRemove"),
                uploading: t("photoUploading"),
                removing: t("photoRemoving"),
                uploaded: tf("photoUpdated"),
                removed: tf("photoRemoved"),
                uploadFailed: tf("uploadFailed"),
                removeFailed: tf("deleteFailed"),
                removeTitle: t("photoRemoveTitle"),
                removeBody: t("photoRemoveBody"),
                removeConfirm: t("photoRemoveConfirm"),
                cancel: tc("cancel"),
                aria: t("photoLabel"),
              }}
            />
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("clubId")} · {formatClubAthleteNumber(athlete.club_athlete_number)}
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-foreground">
                {athlete.last_name} {athlete.first_name}
              </h1>
              {identityParts.length > 0 && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {identityParts.join(" · ")}
                </p>
              )}
              {linkedStaff && (
                <Link
                  href={`/${locale}/people/${linkedStaff.id}`}
                  className="mt-1.5 inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {t("staffBadge")}
                  {linkedStaffFunctions ? ` · ${linkedStaffFunctions}` : ""}
                </Link>
              )}
            </div>
          </div>

          {current && (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-primary bg-card text-3xl font-bold tabular-nums text-primary">
              {current.jerseyNumber ?? "—"}
            </span>
          )}
        </div>
      </section>

      <ProfileTabs items={tabs} label={t("sectionsLabel")} />

      {children}
    </div>
  );
}
