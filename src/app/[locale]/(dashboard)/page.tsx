import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import {
  Shield,
  CalendarRange,
  UserRound,
  UsersRound,
  Trophy,
  ShieldCheck,
  Stethoscope,
  Award,
  FileSignature,
  ChevronRight,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason, getOrganizationSettings, listTeams } from "@/lib/club-data";
import { countLinkedStaffWithoutMembership } from "@/lib/club-users";
import { countPlayersWithDueUnpaidObligations } from "@/lib/first-team-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { CountUp } from "@/components/dashboard/CountUp";
import { TeamBars } from "@/components/dashboard/TeamBars";
import { cn } from "@/lib/utils";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmt(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), "dd.MM.yyyy");
}

type AttentionKind = "reg" | "medical" | "license" | "contract";

const KIND_ICON: Record<AttentionKind, React.ComponentType<{ className?: string }>> = {
  reg: ShieldCheck,
  medical: Stethoscope,
  license: Award,
  contract: FileSignature,
};

interface PersonRow {
  id: string;
  athleteId: string;
  kind: AttentionKind;
  name: string;
  validUntil: string;
  href: string;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("dashboard");
  const canManageUsers = await hasPermission("users.manage");

  const orgId = org.organizationId;
  const threshold =
    (await getOrganizationSettings(supabase, orgId))?.warning_threshold_days ?? 30;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + threshold);
  const cutoffStr = toDateStr(cutoff);

  const [
    teamCount,
    athleteCount,
    staffCount,
    teams,
    activeSeason,
    sub,
    regRows,
    medRows,
    licRows,
    contractRows,
    usersNeedingRole,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    listTeams(supabase, orgId),
    getActiveSeason(supabase, orgId),
    supabase
      .from("subscriptions")
      .select("trial_ends_at, plans(display_name)")
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("registrations")
      .select("id, valid_until, athletes(first_name, last_name)")
      .eq("organization_id", orgId)
      .lte("valid_until", cutoffStr)
      .order("valid_until"),
    supabase
      .from("medical_examinations")
      .select("id, valid_until, athletes(first_name, last_name)")
      .eq("organization_id", orgId)
      .lte("valid_until", cutoffStr)
      .order("valid_until"),
    supabase
      .from("staff_licenses")
      .select("id, valid_until, staff(first_name, last_name)")
      .eq("organization_id", orgId)
      .lte("valid_until", cutoffStr)
      .order("valid_until"),
    supabase
      .from("contracts")
      .select("id, valid_until, athletes(first_name, last_name)")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .lte("valid_until", cutoffStr)
      .order("valid_until"),
    countLinkedStaffWithoutMembership(orgId),
  ]);

  // Distinct players in the ACTIVE season with at least one due, unsettled
  // obligation — the "Dospelo neisplaćeno" row. A player owing several months
  // counts once; old seasons and future months are excluded.
  const overduePaymentsCount = activeSeason
    ? await countPlayersWithDueUnpaidObligations(
        supabase,
        orgId,
        {
          id: activeSeason.id,
          starts_on: activeSeason.starts_on,
          ends_on: activeSeason.ends_on,
        },
        activeSeason.competition_months ?? null
      )
    : 0;

  const firstTeam = teams.find((team) => team.category === "first_team");
  const overduePaymentsHref = firstTeam
    ? `/${locale}/teams/${firstTeam.id}/payments`
    : `/${locale}/teams`;

  const planName =
    (sub.data?.plans as unknown as { display_name: string } | null)?.display_name ??
    "Club";
  const isTrial =
    sub.data?.trial_ends_at && new Date(sub.data.trial_ends_at) > new Date();
  const trialDaysLeft = isTrial
    ? daysUntil(sub.data!.trial_ends_at!.slice(0, 10))
    : 0;

  // ------------------------------------------------------------------
  // Attention feed — real people and real dates, not just counts.
  // ------------------------------------------------------------------
  const personRows: PersonRow[] = [];
  const readName = (v: unknown, fallback: string): string => {
    const athlete = v as { first_name?: string; last_name?: string } | null;
    return athlete?.last_name ? `${athlete.last_name} ${athlete.first_name ?? ""}`.trim() : fallback;
  };

  for (const row of regRows.data ?? []) {
    const r = row as unknown as { id: string; valid_until: string; athletes: unknown };
    personRows.push({
      id: `reg-${r.id}`,
      athleteId: (r.athletes as { id?: string } | null)?.id ?? "",
      kind: "reg",
      name: readName(r.athletes, "—"),
      validUntil: r.valid_until,
      href: `/${locale}/players/${(r.athletes as { id?: string } | null)?.id ?? ""}/registrations`,
    });
  }
  for (const row of medRows.data ?? []) {
    const r = row as unknown as { id: string; valid_until: string; athletes: unknown };
    personRows.push({
      id: `med-${r.id}`,
      athleteId: (r.athletes as { id?: string } | null)?.id ?? "",
      kind: "medical",
      name: readName(r.athletes, "—"),
      validUntil: r.valid_until,
      href: `/${locale}/players/${(r.athletes as { id?: string } | null)?.id ?? ""}/medical`,
    });
  }
  for (const row of licRows.data ?? []) {
    const r = row as unknown as { id: string; valid_until: string; staff: unknown };
    personRows.push({
      id: `lic-${r.id}`,
      athleteId: (r.staff as { id?: string } | null)?.id ?? "",
      kind: "license",
      name: readName(r.staff, "—"),
      validUntil: r.valid_until,
      href: `/${locale}/people/${(r.staff as { id?: string } | null)?.id ?? ""}`,
    });
  }
  for (const row of contractRows.data ?? []) {
    const r = row as unknown as { id: string; valid_until: string; athletes: unknown };
    personRows.push({
      id: `contract-${r.id}`,
      athleteId: (r.athletes as { id?: string } | null)?.id ?? "",
      kind: "contract",
      name: readName(r.athletes, "—"),
      validUntil: r.valid_until,
      href: `/${locale}/players/${(r.athletes as { id?: string } | null)?.id ?? ""}/contracts`,
    });
  }

  // Sort: expired first, then soonest to expire.
  personRows.sort((a, b) => {
    const aExpired = daysUntil(a.validUntil) < 0 ? 1 : 0;
    const bExpired = daysUntil(b.validUntil) < 0 ? 1 : 0;
    if (aExpired !== bExpired) return bExpired - aExpired;
    return daysUntil(a.validUntil) - daysUntil(b.validUntil);
  });

  const attentionTotal =
    personRows.length +
    (usersNeedingRole > 0 ? 1 : 0) +
    (overduePaymentsCount > 0 ? 1 : 0) +
    (!activeSeason ? 1 : 0) +
    (athleteCount.count === 0 && activeSeason ? 1 : 0);

  const kpis = [
    {
      key: "teams",
      label: t("cards.teams"),
      value: teamCount.count ?? 0,
      text: null as string | null,
      icon: <Shield />,
    },
    {
      key: "players",
      label: t("cards.players"),
      value: athleteCount.count ?? 0,
      text: null,
      icon: <UserRound />,
    },
    {
      key: "staff",
      label: t("cards.staff"),
      value: staffCount.count ?? 0,
      text: null,
      icon: <UsersRound />,
    },
    {
      key: "season",
      label: t("cards.activeSeason"),
      value: 0,
      text: activeSeason?.name ?? t("cards.noSeason"),
      icon: <CalendarRange />,
      href: `/${locale}/seasons`,
    },
  ] as { key: string; label: string; value: number; text: string | null; icon: React.ReactNode; href?: string }[];

  const rosterTotal = teams.reduce((sum, team) => sum + team.athlete_count, 0);

  return (
    <div className="space-y-7">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Trial notice — a quiet single line */}
      {isTrial && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span className="font-medium text-foreground">
            {t("trial.daysLeft", { count: trialDaysLeft })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t("trial.plan", { plan: planName })}</span>
        </p>
      )}

      {/* Stats ribbon — one coherent command-center surface */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-0.5 w-full bg-primary" aria-hidden="true" />
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {kpis.map((kpi, index) => {
            const body = (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/70 [&_svg]:h-4 [&_svg]:w-4">
                    {kpi.icon}
                  </span>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {kpi.label}
                  </p>
                </div>
                {kpi.text !== null ? (
                  <p
                    className="mt-2 truncate text-2xl font-semibold leading-none tracking-tight text-foreground sm:text-3xl"
                    title={kpi.text}
                  >
                    {kpi.text}
                  </p>
                ) : (
                  <p className="mt-2 text-3xl font-semibold leading-none tabular-nums tracking-tight text-foreground sm:text-[2.5rem]">
                    <CountUp value={kpi.value} />
                  </p>
                )}
              </>
            );
            const baseClass = "animate-rise px-5 py-5 sm:py-6";
            const style = { animationDelay: `${index * 50}ms` };
            return kpi.href ? (
              <Link
                key={kpi.key}
                href={kpi.href}
                style={style}
                className={cn(
                  baseClass,
                  "block transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                )}
              >
                {body}
              </Link>
            ) : (
              <div key={kpi.key} style={style} className={baseClass}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ZAHTEVA PAŽNJU — the main operational panel */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <PanelHeader
          title={t("attention.title")}
          right={
            attentionTotal > 0 ? (
              <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">
                {attentionTotal}
              </span>
            ) : undefined
          }
        />
          {attentionTotal === 0 ? (
            <div className="px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t("attention.nothingTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("attention.nothingDesc")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {!activeSeason && (
                <AttentionRow
                  icon={<Trophy className="h-[18px] w-[18px]" />}
                  tone="action"
                  text={t("attention.noActiveSeason")}
                  href={`/${locale}/seasons`}
                  actionLabel={t("attention.startSeason")}
                  delay={0}
                />
              )}
              {athleteCount.count === 0 && activeSeason && (
                <AttentionRow
                  icon={<UserRound className="h-[18px] w-[18px]" />}
                  tone="action"
                  text={t("attention.noPlayers")}
                  href={`/${locale}/players`}
                  actionLabel={t("attention.addPlayer")}
                  delay={40}
                />
              )}
              {personRows.map((row, index) => {
                const Icon = KIND_ICON[row.kind];
                const expired = daysUntil(row.validUntil) < 0;
                const days = daysUntil(row.validUntil);
                const relLabel = expired
                  ? t("attention.expiredLabel")
                  : days === 0
                    ? t("attention.today")
                    : t("attention.inDays", { count: days });
                return (
                  <li
                    key={row.id}
                    className="animate-rise"
                    style={{ animationDelay: `${index * 40 + 80}ms` }}
                  >
                    <Link
                      href={row.href}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                    >
                      <span
                        className={cn(
                          "shrink-0",
                          expired ? "text-danger" : "text-warning"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                            {row.name}
                          </span>
                          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                            {t(
                              expired
                                ? `attention.${kindKey(row.kind)}Expired`
                                : `attention.${kindKey(row.kind)}Item`
                            )}
                          </span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground sm:hidden">
                          {t(
                            expired
                              ? `attention.${kindKey(row.kind)}Expired`
                              : `attention.${kindKey(row.kind)}Item`
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={cn(
                            "block text-xs font-semibold tabular-nums",
                            expired ? "text-danger" : "text-warning"
                          )}
                        >
                          {relLabel}
                        </span>
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {fmt(row.validUntil)}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  </li>
                );
              })}
              {canManageUsers && usersNeedingRole > 0 && (
                <AttentionRow
                  icon={<UsersRound className="h-[18px] w-[18px]" />}
                  tone="attention"
                  text={t("attention.usersWithoutRole", { count: usersNeedingRole })}
                  href={`/${locale}/club/users`}
                  actionLabel={t("attention.open")}
                  delay={personRows.length * 40 + 120}
                />
              )}
              {overduePaymentsCount > 0 ? (
                <AttentionRow
                  icon={<CircleAlert className="h-[18px] w-[18px]" />}
                  tone="danger"
                  text={t("attention.overduePayments", { count: overduePaymentsCount })}
                  href={overduePaymentsHref}
                  actionLabel={t("attention.open")}
                  delay={personRows.length * 40 + 160}
                />
              ) : null}
            </ul>
          )}
        </section>

      {/* Players by team — white analytics panel */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <PanelHeader
          title={t("distribution.title")}
          subtitle={t("distribution.description")}
          right={
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {t("distribution.total", { count: rosterTotal })}
            </span>
          }
        />
        <div className="px-4 py-4 sm:px-5">
          {teams.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">{t("distribution.noTeams")}</p>
              <Link
                href={`/${locale}/teams`}
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("distribution.addTeam")}
              </Link>
            </div>
          ) : rosterTotal === 0 ? (
            <p className="text-sm text-muted-foreground">{t("distribution.noRoster")}</p>
          ) : (
            <TeamBars
              teams={teams.map((team) => ({
                id: team.id,
                name: team.name,
                count: team.athlete_count,
              }))}
              locale={locale}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

function kindKey(kind: AttentionKind): "reg" | "med" | "lic" | "contract" {
  switch (kind) {
    case "reg":
      return "reg";
    case "medical":
      return "med";
    case "license":
      return "lic";
    case "contract":
      return "contract";
  }
}

type RowTone = "attention" | "danger" | "action";

function AttentionRow({
  icon,
  tone,
  text,
  href,
  actionLabel,
  delay,
}: {
  icon: React.ReactNode;
  tone: RowTone;
  text: string;
  href: string;
  actionLabel: string;
  delay: number;
}) {
  const toneColor =
    tone === "danger"
      ? "text-danger"
      : tone === "action"
        ? "text-primary"
        : "text-warning";
  return (
    <li className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className={cn("shrink-0", toneColor)}>{icon}</span>
        <span className="min-w-0 flex-1 text-sm text-foreground">{text}</span>
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
        >
          {actionLabel}
        </Link>
      </div>
    </li>
  );
}