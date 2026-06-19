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

export interface WeeklyVolumeTrendPoint {
  week_start: string;
  volume: number;
  revenue_kes: number;
}

function fmtWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumeTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="week_start"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtWeek}
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
          labelFormatter={(label) => {
            const d = new Date(String(label) + "T00:00:00Z");
            return `Week of ${d.toLocaleDateString("en-KE", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
          }}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
        />
        <Bar dataKey="volume" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
