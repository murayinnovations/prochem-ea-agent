import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiStatProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  className?: string;
}

export function KpiStat({ label, value, delta, deltaLabel, icon: Icon, className }: KpiStatProps) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {Icon && (
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 sm:flex">
            <Icon className="h-4 w-4 text-amber-500" />
          </div>
        )}
      </div>
      <p className="mt-2 text-lg font-bold tracking-tight text-slate-900 sm:mt-2.5 sm:text-2xl">{value}</p>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            isPositive && "text-emerald-600",
            isNegative && "text-red-500",
            !isPositive && !isNegative && "text-slate-400",
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : isNegative ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          <span>
            {isPositive ? "+" : ""}
            {delta.toFixed(1)}%{deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
