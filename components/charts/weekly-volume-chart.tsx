"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Granularity } from "@/lib/queries/brands";

export interface WeeklyVolumeTrendPoint {
  week_start: string;
  volume: number;
  revenue_kes: number;
}

function fmtTick(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr + "T00:00:00Z");
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtLabel(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr + "T00:00:00Z");
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-KE", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  if (granularity === "daily") {
    return d.toLocaleDateString("en-KE", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  return `Week of ${d.toLocaleDateString("en-KE", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
}

export function WeeklyVolumeChart({
  data,
  granularity = "weekly",
}: {
  data: WeeklyVolumeTrendPoint[];
  granularity?: Granularity;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="week_start"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtTick(String(v), granularity)}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v) => [Number(v).toLocaleString(), "Volume"]}
          labelFormatter={(label) => fmtLabel(String(label), granularity)}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
        />
        <Bar dataKey="volume" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
