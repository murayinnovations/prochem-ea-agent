"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { formatKES } from "@/lib/formatters";

export interface SparklinePoint {
  month: string; // ISO date, first-of-month
  value: number;
}

// Rendered from a server component, so props must be serializable: the icon
// arrives as an element and values are always KES (functions can't cross over).
interface Props {
  title: string;
  icon?: ReactNode;
  data: SparklinePoint[];
}

export function SparklineCard({ title, icon, data }: Props) {
  const last = data.at(-1);
  const prev = data.at(-2);
  const delta = last && prev && prev.value !== 0 ? ((last.value - prev.value) / prev.value) * 100 : null;
  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            {icon}
          </div>
        )}
      </div>
      <p className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900">
        {last ? formatKES(last.value) : "—"}
      </p>
      {delta !== null && (
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
            {delta.toFixed(1)}% MoM
          </span>
        </div>
      )}
      <div className="mt-3 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Tooltip
              formatter={(v) => [formatKES(v as number), title]}
              labelFormatter={(label) => {
                try {
                  return format(parseISO(label as string), "MMM yyyy");
                } catch {
                  return String(label);
                }
              }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
