import { requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/layout/EmptyState";

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();

  const { data: orgData } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", org.organizationId)
    .single();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, plans(name, display_name)")
    .eq("organization_id", org.organizationId)
    .single();

  const planName = (sub?.plans as unknown as { display_name: string })
    ?.display_name;
  const isTrial =
    sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date();
  const trialDaysLeft = isTrial ? daysUntil(sub!.trial_ends_at!) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Dobrodošli u {orgData?.name || "STOŽER"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Vaš klub je spreman za rad
        </p>
      </div>

      {isTrial && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">
            Probni period: još {trialDaysLeft}{" "}
            {trialDaysLeft === 1 ? "dan" : "dana"}
          </p>
          <p className="text-sm text-muted-foreground">
            Trenutni plan: {planName || "Club"} (probni period)
          </p>
        </div>
      )}

      <EmptyState
        title="Počnite sa podešavanjem"
        description="Dodajte svoj prvi tim, igrače i osoblje kako biste počeli da koristite STOŽER."
        actionLabel="Dodaj tim"
        actionHref={`/${locale}/teams`}
      />
    </div>
  );
}
