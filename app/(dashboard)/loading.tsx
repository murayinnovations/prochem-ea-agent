import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly on navigation while a dashboard page renders on the server,
// so clicking a sidebar link never looks like nothing happened.
export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
