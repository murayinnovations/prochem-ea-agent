"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { formatKES } from "@/lib/formatters";
import type { TrendPoint } from "@/lib/queries/management-accounts";

interface Option {
  group: "P&L Account" | "Customer (AR)" | "Stock Item";
  key: string; // unique across groups
  label: string;
  series: TrendPoint[];
}

const LINE_COLORS = ["#f59e0b", "#10b981", "#6366f1"];

function monthLabel(iso: string): string {
  try {
    return format(parseISO(iso), "MMM yy");
  } catch {
    return iso;
  }
}

export function TrendsChart({ options }: { options: Option[] }) {
  const [selected, setSelected] = useState<(string | null)[]>([options[0]?.key ?? null, null, null]);

  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);

  const chartData = useMemo(() => {
    const activeOptions = selected.map((k) => (k ? byKey.get(k) : null)).filter(Boolean) as Option[];
    const monthsSet = new Set<string>();
    for (const o of activeOptions) for (const p of o.series) monthsSet.add(p.month);
    const months = Array.from(monthsSet).sort();

    return months.map((m) => {
      const row: Record<string, string | number | null> = { month: m };
      for (const o of activeOptions) {
        const point = o.series.find((p) => p.month === m);
        row[o.key] = point ? point.value : null;
      }
      return row;
    });
  }, [selected, byKey]);

  const activeOptions = selected.map((k) => (k ? byKey.get(k) : null)).filter(Boolean) as Option[];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <select
            key={i}
            value={selected[i] ?? ""}
            onChange={(e) => {
              const next = [...selected];
              next[i] = e.target.value || null;
              setSelected(next);
            }}
            className="h-9 w-full sm:w-auto sm:min-w-[220px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">{i === 0 ? "Pick a line to chart…" : `Compare with… (line ${i + 1})`}</option>
            {(["P&L Account", "Customer (AR)", "Stock Item"] as const).map((group) => (
              <optgroup key={group} label={group}>
                {options
                  .filter((o) => o.group === group)
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {activeOptions.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">Pick a line above to see its trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={monthLabel}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v: number) => formatKES(v)}
              />
              <Tooltip
                labelFormatter={(label) => monthLabel(label as string)}
                formatter={(v, name) => [v == null ? "—" : formatKES(v as number), byKey.get(name as string)?.label ?? name]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              />
              <Legend
                formatter={(name) => byKey.get(name as string)?.label ?? name}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {activeOptions.map((o, i) => (
                <Line
                  key={o.key}
                  type="monotone"
                  dataKey={o.key}
                  name={o.key}
                  stroke={LINE_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export type { Option as TrendSeriesOption };
