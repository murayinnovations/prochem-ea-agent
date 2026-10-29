"use client";

import { useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshDashboardData } from "@/app/(dashboard)/actions";

// Ticks every 30s; snapshots are bucketed so they stay stable between ticks.
const TICK_MS = 30_000;
function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
}
const clockSnapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

interface Props {
  lastRefreshed: string;
}

export function RefreshButton({ lastRefreshed }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Relative time depends on the viewer's clock and timezone, so the server
  // snapshot is null and the label only renders on the client.
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, () => null);

  const refreshedAt = new Date(lastRefreshed);

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs text-slate-500"
        title={now != null ? format(refreshedAt, "dd MMM yyyy, HH:mm:ss") : undefined}
      >
        {pending
          ? "Refreshing…"
          : now != null
            ? `Refreshed ${formatDistanceToNow(refreshedAt, { addSuffix: true })}`
            : " "}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label="Refresh data"
        onClick={() =>
          startTransition(async () => {
            await refreshDashboardData();
            router.refresh();
          })
        }
      >
        <RotateCw className={cn("mr-1.5 h-3.5 w-3.5", pending && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}
