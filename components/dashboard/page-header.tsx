import type { ReactNode } from "react";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { getLastRefreshed } from "@/lib/cache";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export async function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const lastRefreshed = await getLastRefreshed();

  return (
    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-serif, var(--font-geist-sans))" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-xs sm:text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <RefreshButton lastRefreshed={lastRefreshed} />
        {actions}
      </div>
    </div>
  );
}
