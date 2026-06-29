import { Suspense } from "react";
import { format, subDays } from "date-fns";
import { TrendingUp, Receipt, Users, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createServerClient } from "@/lib/supabase/server";
import { formatKES, formatKESFull, formatDate } from "@/lib/formatters";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { TopCustomersChart } from "@/components/charts/top-customers-chart";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function cutoffs() {
  const today = new Date();
  return {
    d30: format(subDays(today, 30), "yyyy-MM-dd"),
    d90: format(subDays(today, 90), "yyyy-MM-dd"),
  };
}

// ── skeleton placeholders ─────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0A1B3D] px-8 py-9">
      <Skeleton className="h-2.5 w-36 bg-white/10" />
      <Skeleton className="mt-4 h-12 w-56 bg-white/10" />
      <Skeleton className="mt-4 h-2.5 w-80 bg-white/10" />
    </div>
  );
}

function HeroAndKpiSkeleton() {
  return (
    <div className="space-y-4">
      <HeroSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="mt-3 h-8 w-36" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </CardContent>
    </Card>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p>
      </div>
      <div className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
        <Icon className="h-4 w-4 text-amber-500" />
      </div>
    </div>
  );
}

// ── Hero + KPI section (single fetch, single Suspense) ────────────────────────

async function HeroAndKpiSection() {
  const supabase = await createServerClient();
  const { d30 } = cutoffs();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [revResult, cntResult, codesResult, custResult, arCntResult] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("doc_total, vat_sum")
        .gte("doc_date", d30)
        .lte("doc_date", todayStr)
        .eq("cancelled", false),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .gte("doc_date", d30)
        .lte("doc_date", todayStr)
        .eq("cancelled", false),
      supabase
        .from("invoices")
        .select("card_code")
        .gte("doc_date", d30)
        .lte("doc_date", todayStr)
        .eq("cancelled", false),
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("card_type", "C")
        .eq("valid", true),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("doc_status", "O")
        .eq("cancelled", false),
    ]);

  // AR total — paginated SUM to clear PostgREST's 1000-row default cap
  let arTotal = 0;
  for (let page = 0; page < 200; page++) {
    const { data: balPage } = await supabase
      .from("customers")
      .select("balance")
      .eq("card_type", "C")
      .eq("valid", true)
      .gt("balance", 0)
      .range(page * 1000, (page + 1) * 1000 - 1);
    const balRows = balPage ?? [];
    for (const r of balRows) arTotal += Number(r.balance ?? 0);
    if (balRows.length < 1000) break;
  }

  const revenue30d = (revResult.data ?? []).reduce(
    (s, r) => s + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0),
    0,
  );
  const invoiceCount = cntResult.count ?? 0;
  const activeCustomers = new Set(
    (codesResult.data ?? []).map((r) => r.card_code),
  ).size;
  const totalCustomers = custResult.count ?? 0;
  const arCount = arCntResult.count ?? 0;

  // Latest invoice date for freshness
  const { data: latestInv } = await supabase
    .from("invoices")
    .select("doc_date")
    .eq("cancelled", false)
    .order("doc_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDate = latestInv?.doc_date as string | null;
  const daysDiff = latestDate
    ? Math.floor((Date.now() - new Date(latestDate).getTime()) / 86_400_000)
    : null;
  const freshnessLabel =
    daysDiff === null
      ? null
      : daysDiff === 0
        ? "updated today"
        : daysDiff === 1
          ? "updated yesterday"
          : `updated ${daysDiff}d ago`;

  return (
    <div className="space-y-4">
      {/* ── Hero gradient strip ───────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-9"
        style={{
          background:
            "linear-gradient(135deg, #0A1B3D 0%, #0F2554 55%, #162E66 100%)",
        }}
      >
        {/* Amber top-border accent */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 via-amber-400/60 to-transparent" />
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber-500/[0.06]" />
        <div className="pointer-events-none absolute right-32 top-4 h-40 w-40 rounded-full bg-blue-500/[0.04]" />

        {/* Content */}
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
          Revenue · Last 30 Days
          {freshnessLabel && (
            <span
              className={cn(
                "ml-3 font-medium normal-case tracking-normal",
                (daysDiff ?? 0) > 2 ? "text-amber-500" : "text-slate-500",
              )}
            >
              · {freshnessLabel}
            </span>
          )}
        </p>

        <p className="mt-2 font-mono text-5xl font-extrabold tracking-tight text-white">
          {formatKES(revenue30d)}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <span className="text-slate-300">
            {invoiceCount.toLocaleString()} invoices
          </span>
          <span className="hidden text-slate-600 sm:inline">·</span>
          <span className="text-slate-300">
            {activeCustomers.toLocaleString()} active customers
          </span>
          <span className="hidden text-slate-600 sm:inline">·</span>
          <span className="font-semibold text-amber-400">
            {formatKES(arTotal)} AR outstanding
          </span>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue (30d)"
          value={formatKES(revenue30d)}
          sublabel="ex-VAT, invoiced"
          icon={TrendingUp}
        />
        <MetricCard
          label="Invoices Raised"
          value={invoiceCount.toLocaleString()}
          sublabel="last 30 days"
          icon={Receipt}
        />
        <MetricCard
          label="Active Customers"
          value={activeCustomers.toLocaleString()}
          sublabel={`of ${totalCustomers.toLocaleString()} on ledger`}
          icon={Users}
        />
        <MetricCard
          label="Outstanding AR"
          value={formatKES(arTotal)}
          sublabel={`${arCount.toLocaleString()} open invoices`}
          icon={Clock}
        />
      </div>
    </div>
  );
}

// ── Revenue trend ─────────────────────────────────────────────────────────────

async function RevenueTrendSection() {
  const supabase = await createServerClient();
  const { d90 } = cutoffs();

  const { data: rows } = await supabase
    .from("invoices")
    .select("doc_date, doc_total, vat_sum")
    .gte("doc_date", d90)
    .eq("cancelled", false)
    .order("doc_date", { ascending: true });

  const byDate = new Map<string, number>();
  for (const r of rows ?? []) {
    const d = r.doc_date as string;
    byDate.set(d, (byDate.get(d) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0));
  }
  const trendData = Array.from(byDate.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Revenue trend — last 90 days
        </CardTitle>
        <p className="text-xs text-slate-400">Ex-VAT, daily invoiced</p>
      </CardHeader>
      <CardContent className="pt-0">
        <RevenueAreaChart data={trendData} />
      </CardContent>
    </Card>
  );
}

// ── Recent invoices ───────────────────────────────────────────────────────────

async function RecentInvoicesSection() {
  const supabase = await createServerClient();

  const { data: rows } = await supabase
    .from("invoices")
    .select("doc_num, doc_date, card_code, doc_total, doc_status")
    .eq("cancelled", false)
    .order("doc_date", { ascending: false })
    .limit(10);

  const codes = [...new Set((rows ?? []).map((r) => r.card_code))];
  const { data: custRows } = codes.length
    ? await supabase
        .from("customers")
        .select("card_code, card_name")
        .in("card_code", codes)
    : { data: [] };
  const nameMap: Record<string, string> = {};
  for (const c of custRows ?? []) {
    if (c.card_code)
      nameMap[c.card_code] = (c.card_name as string | null) ?? c.card_code;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Recent Invoices
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-500">
                Doc #
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">
                Date
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">
                Customer
              </TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500">
                Total
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-slate-400"
                >
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              (rows ?? []).map((inv, i) => (
                <TableRow
                  key={inv.doc_num ?? `r${i}`}
                  className="border-slate-100 hover:bg-slate-50"
                >
                  <TableCell className="font-mono text-sm text-slate-700">
                    {inv.doc_num ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(inv.doc_date as string)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm font-medium text-slate-900">
                    {nameMap[inv.card_code] ?? inv.card_code}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {formatKESFull(Number(inv.doc_total ?? 0))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 text-xs font-medium",
                        inv.doc_status === "O"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {inv.doc_status === "C"
                        ? "Closed"
                        : inv.doc_status === "O"
                          ? "Open"
                          : (inv.doc_status ?? "—")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Top customers ─────────────────────────────────────────────────────────────

async function TopCustomersSection() {
  const supabase = await createServerClient();
  const { d30 } = cutoffs();

  const { data: rows } = await supabase
    .from("invoices")
    .select("card_code, doc_total, vat_sum")
    .gte("doc_date", d30)
    .eq("cancelled", false);

  const totals = new Map<string, number>();
  for (const r of rows ?? []) {
    totals.set(
      r.card_code,
      (totals.get(r.card_code) ?? 0) +
        Number(r.doc_total ?? 0) -
        Number(r.vat_sum ?? 0),
    );
  }

  const topCodes = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code]) => code);

  const { data: custRows } = topCodes.length
    ? await supabase
        .from("customers")
        .select("card_code, card_name")
        .in("card_code", topCodes)
    : { data: [] };

  const nameMap: Record<string, string> = {};
  for (const c of custRows ?? []) {
    if (c.card_code)
      nameMap[c.card_code] = (c.card_name as string | null) ?? c.card_code;
  }

  const topCustomers = topCodes.map((code) => ({
    card_name: nameMap[code] ?? code,
    total: totals.get(code) ?? 0,
  }));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Top Customers — last 30 days
        </CardTitle>
        <p className="text-xs text-slate-400">By revenue, ex-VAT</p>
      </CardHeader>
      <CardContent className="pt-0">
        <TopCustomersChart data={topCustomers} />
      </CardContent>
    </Card>
  );
}

// ── Sales employee ────────────────────────────────────────────────────────────

async function SalesEmployeeSection() {
  const supabase = await createServerClient();
  const { d30 } = cutoffs();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("invoices")
    .select("slp_name, doc_total, vat_sum")
    .gte("doc_date", d30)
    .lte("doc_date", todayStr)
    .eq("cancelled", false);

  const rows = data ?? [];
  const hasData = rows.some((r) => r.slp_name != null);

  if (!hasData) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Revenue by Sales Employee (30d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-slate-400">
            Sales employee data will appear after the next SAP sync
            <br />
            <span className="text-xs text-slate-300">
              (slp_name column added — awaiting re-sync)
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  const map = new Map<string, number>();
  for (const r of rows) {
    const name = (r.slp_name as string | null) ?? "(unassigned)";
    map.set(
      name,
      (map.get(name) ?? 0) +
        Number(r.doc_total ?? 0) -
        Number(r.vat_sum ?? 0),
    );
  }
  const chartData = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([card_name, total]) => ({ card_name, total }));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Revenue by Sales Employee — last 30 days
        </CardTitle>
        <p className="text-xs text-slate-400">Ex-VAT</p>
      </CardHeader>
      <CardContent className="pt-0">
        <TopCustomersChart data={chartData} />
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<HeroAndKpiSkeleton />}>
        <HeroAndKpiSection />
      </Suspense>

      <Suspense fallback={<CardSkeleton height={280} />}>
        <RevenueTrendSection />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton height={300} />}>
          <RecentInvoicesSection />
        </Suspense>
        <Suspense fallback={<CardSkeleton height={300} />}>
          <TopCustomersSection />
        </Suspense>
      </div>

      <Suspense fallback={<CardSkeleton height={280} />}>
        <SalesEmployeeSection />
      </Suspense>
    </div>
  );
}
