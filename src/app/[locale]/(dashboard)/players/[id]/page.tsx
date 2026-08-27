import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { differenceInCalendarYears } from "date-fns";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getAthleteWithMemberships } from "@/lib/club-data";
import { formatClubAthleteNumber } from "@/lib/athlete-id";
import { updatePlayerFederationId } from "../actions";

function ageOf(birthDate: string): number {
  return differenceInCalendarYears(new Date(), new Date(birthDate));
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.profile");

  const [canView, canEdit] = await Promise.all([
    hasPermission("athletes.view"),
    hasPermission("athletes.edit"),
  ]);
  if (!canView) notFound();

  const athlete = await getAthleteWithMemberships(
    supabase,
    org.organizationId,
    id
  );
  if (!athlete) notFound();

  const current = athlete.memberships.find((m) => m.isActive);
  const past = athlete.memberships.filter((m) => !m.isActive);

  const sectionLinks = [
    "registrations",
    "medical",
    "guardians",
    "documents",
    "contracts",
    "equipment",
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/players"
          className="text-sm text-primary hover:underline"
        >
          ← {t("back")}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {athlete.last_name} {athlete.first_name}
        </h1>
      </div>

      {/* Club athlete ID — payment reference (D-05). */}
      <div className="rounded-xl border border-border p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("clubId")}
        </p>
        <p className="font-mono text-3xl font-bold">
          {formatClubAthleteNumber(athlete.club_athlete_number)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("clubIdNote")}</p>
      </div>

      {/* Identity core (STRC-03). */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("identity")}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("birthDate")}</dt>
            <dd>
              {athlete.birth_date} ({ageOf(athlete.birth_date)})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("gender")}</dt>
            <dd>
              {athlete.gender ? t(`genders.${athlete.gender}`) : t("notSet")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("nationality")}</dt>
            <dd>{athlete.nationality || t("notSet")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("position")}</dt>
            <dd>{athlete.position || t("notSet")}</dd>
          </div>
        </dl>
      </section>

      {/* Federation / Registration ID (D-06, REG-05): free-text, reference only. */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("federationId")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("federationIdNote")}</p>
        <form action={updatePlayerFederationId} className="mt-3 flex gap-2">
          <input type="hidden" name="id" value={athlete.id} />
          <input
            name="federation_id"
            defaultValue={athlete.federation_id ?? ""}
            disabled={!canEdit}
            placeholder={t("federationIdPlaceholder")}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          {canEdit && (
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              {t("save")}
            </button>
          )}
        </form>
      </section>

      {/* Current season membership (primary) + past memberships (collapsed, D-04). */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("memberships")}</h2>
        {current ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("team")}</dt>
              <dd>{current.teamName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("jersey")}</dt>
              <dd>{current.jerseyNumber ?? t("notSet")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("season")}</dt>
              <dd>{current.seasonName}</dd>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("noMembership")}</p>
        )}

        {past.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t("pastMemberships")} ({past.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {past.map((m) => (
                <li key={m.seasonId} className="flex justify-between">
                  <span>{m.seasonName}</span>
                  <span className="text-muted-foreground">
                    {m.teamName}
                    {m.jerseyNumber ? ` · ${m.jerseyNumber}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Sub-route section links (404 until their plans ship — accepted gap). */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{t("sectionsLabel")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {sectionLinks.map((s) => (
            <Link
              key={s}
              href={`/players/${athlete.id}/${s}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              {t(`sections.${s}`)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
