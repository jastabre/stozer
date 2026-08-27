import { requireOrganization } from "@/lib/organization";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify user has valid org membership
  const org = await requireOrganization();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar orgId={org.organizationId} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
