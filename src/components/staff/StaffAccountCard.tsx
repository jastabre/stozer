import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import type { AccountOverview } from "@/lib/club-users";
import type { AccountStatus } from "@/lib/account-status";
import type { RoleMetadataView } from "@/lib/staff-profile";

interface StaffAccountCardProps {
  account: AccountOverview | null;
  /** users.manage — may open Klub → Korisnici i pristup. */
  canEditAccess: boolean;
  /** Read-only role metadata of the person's current role. */
  role: RoleMetadataView | null;
  locale: string;
}

const STATUS_TONES: Record<AccountStatus, StatusTone> = {
  none: "muted",
  invited: "blue",
  active: "green",
  disabled: "red",
};

/**
 * "STOŽER PRISTUP" card on the staff overview: read-only status of the person's
 * account ("Aktivan" / "Nema pristup") plus, when access exists, their Stožer
 * role. A single "Upravljaj pristupom" link leads to the central
 * Klub → Korisnici i pristup screen — the ONLY place a role or access is ever
 * assigned. This card never hosts a form, a role selector or an invite.
 */
export async function StaffAccountCard({
  account,
  canEditAccess,
  role,
  locale,
}: StaffAccountCardProps) {
  const t = await getTranslations("people");

  const statusLabels: Record<AccountStatus, string> = {
    none: t("account.noAccount"),
    active: t("account.active"),
    invited: t("account.invited"),
    disabled: t("account.disabled"),
  };

  const actionSecondary =
    "inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary";

  return (
    <aside className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("account.title")}
          </h2>
          <StatusBadge
            tone={account ? STATUS_TONES[account.status] : "muted"}
            label={account ? statusLabels[account.status] : statusLabels.none}
          />
        </div>

        {account && (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("account.role")}: </span>
            <span className="font-medium text-foreground">
              {role?.label ?? "—"}
            </span>
          </p>
        )}

        {canEditAccess && (
          <Link
            href={
              account
                ? `/${locale}/club/users?user=${account.userId}`
                : `/${locale}/club/users`
            }
            className={actionSecondary}
          >
            {t("account.manageAccess")}
          </Link>
        )}
      </div>
    </aside>
  );
}
