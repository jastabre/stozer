import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" data-testid="page-skeleton">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64" />
    </div>
  );
}
