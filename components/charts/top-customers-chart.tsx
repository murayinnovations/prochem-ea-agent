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

export interface CustomerRevenue {
  card_name: string;
  total: number;
}

const Y_WIDTH = 172;
const MAX_CHARS = 22;

function fmtTick(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function fmtTooltip(v: unknown): string {
  const n = typeof v === "number" ? v : 0;
  if (n >= 1e9) return `KES ${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`;
  return `KES ${n.toFixed(0)}`;
}

// Truncates long names so they fit the fixed Y-axis width.
function truncate(name: string): string {
  if (name.length <= MAX_CHARS) return name;
  // Prefer word-boundary truncation
  const cut = name.slice(0, MAX_CHARS).replace(/\s\S+$/, "");
  return (cut || name.slice(0, MAX_CHARS)) + "…";
}

// Custom tick — shows truncated label; SVG <title> gives full name on hover.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function YTick(props: any) {
  const x: number = typeof props.x === "number" ? props.x : 0;
  const y: number = typeof props.y === "number" ? props.y : 0;
  const full: string = props.payload?.value ?? "";
  const short = truncate(full);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text x={0} y={0} dy={4} textAnchor="end" fill="#64748b" fontSize={10}>
        {short}
      </text>
    </g>
  );
}

export function TopCustomersChart({ data }: { data: CustomerRevenue[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e2e8f0"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={fmtTick}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="card_name"
          tick={YTick}
          width={Y_WIDTH}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          formatter={(v) => [fmtTooltip(v), "Revenue"]}
          labelFormatter={(label) => label}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
        <Bar
          dataKey="total"
          fill="#10b981"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
