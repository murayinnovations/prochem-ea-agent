import { Suspense } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
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
import {
  getOverviewKpis,
  getRevenueTrend90d,
  getRecentInvoices,
  getTopCustomers30d,
  getSalesEmployeeRevenue30d,
} from "@/lib/queries/overview";
import { getLastRefreshed } from "@/lib/cache";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { formatKES, formatKESFull, formatDate } from "@/lib/formatters";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { TopCustomersChart } from "@/components/charts/top-customers-chart";
import { cn } from "@/lib/utils";

// Reads live Supabase data — render per request instead of prerendering at build time.
export const dynamic = "force-dynamic";

// ── skeleton placeholders ─────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0A1B3D] px-5 py-6 sm:px-8 sm:py-9">
      <Skeleton className="h-2.5 w-36 bg-white/10" />
      <Skeleton className="mt-4 h-12 w-56 bg-white/10" />
      <Skeleton className="mt-4 h-2.5 w-full max-w-80 bg-white/10" />
    </div>
  );
}

function HeroAndKpiSkeleton() {
  return (
    <div className="space-y-4">
      <HeroSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-2 whitespace-nowrap text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p>
      </div>
      <div className="ml-4 hidden h-9 w-9 shrink-0 items-center sm:flex justify-center rounded-lg bg-amber-50">
        <Icon className="h-4 w-4 text-amber-500" />
      </div>
    </div>
  );
}

// ── Hero + KPI section (single fetch, single Suspense) ────────────────────────

async function HeroAndKpiSection() {
  const {
    revenue30d,
    invoiceCount,
    activeCustomers,
    totalCustomers,
    arCount,
    arTotal,
    latestDate,
  } = await getOverviewKpis();

  const daysDiff = latestDate
    ? differenceInCalendarDays(new Date(), parseISO(latestDate))
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
        className="relative overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-9"
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

        <p className="mt-2 break-words font-mono text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
  const trendData = await getRevenueTrend90d();

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
  const rows = await getRecentInvoices();

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
              <TableHead className="hidden text-xs font-semibold text-slate-500 sm:table-cell">
                Doc #
              </TableHead>
              <TableHead className="hidden text-xs font-semibold text-slate-500 sm:table-cell">
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-slate-400"
                >
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((inv, i) => (
                <TableRow
                  key={inv.doc_num ?? `r${i}`}
                  className="border-slate-100 hover:bg-slate-50"
                >
                  <TableCell className="hidden font-mono text-sm text-slate-700 sm:table-cell">
                    {inv.doc_num ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-500 sm:table-cell">
                    {formatDate(inv.doc_date)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm font-medium text-slate-900">
                    {inv.card_name}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    <span className="sm:hidden">{formatKES(inv.doc_total)}</span>
                    <span className="hidden sm:inline">{formatKESFull(inv.doc_total)}</span>
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
  const topCustomers = await getTopCustomers30d();

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
  const chartData = await getSalesEmployeeRevenue30d();

  if (!chartData) {
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

export default async function OverviewPage() {
  const lastRefreshed = await getLastRefreshed();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton lastRefreshed={lastRefreshed} />
      </div>

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
