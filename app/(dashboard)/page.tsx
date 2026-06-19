import { Suspense } from "react";
import { format, subDays } from "date-fns";
import { TrendingUp, Receipt, Users, Clock } from "lucide-react";
import {
  Card,
  CardAction,
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

// ── date helpers ──────────────────────────────────────────────────────────────

function cutoffs() {
  const today = new Date();
  return {
    d30: format(subDays(today, 30), "yyyy-MM-dd"),
    d90: format(subDays(today, 90), "yyyy-MM-dd"),
  };
}

// ── skeleton placeholders ─────────────────────────────────────────────────────

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-3 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-36" />
            <Skeleton className="mt-2 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
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

// ── Data freshness ────────────────────────────────────────────────────────────

async function DataFreshnessNote() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("doc_date")
    .eq("cancelled", false)
    .order("doc_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.doc_date) return null;

  const latest = data.doc_date as string;
  const daysDiff = Math.floor(
    (Date.now() - new Date(latest).getTime()) / 86_400_000,
  );
  const label =
    daysDiff === 0
      ? "today"
      : daysDiff === 1
        ? "yesterday"
        : `${daysDiff} days ago`;

  return (
    <span className="text-xs text-slate-400">
      Data through{" "}
      <span className={daysDiff > 2 ? "text-amber-500 font-medium" : "text-slate-500 font-medium"}>
        {formatDate(latest)}
      </span>{" "}
      ({label})
    </span>
  );
}

// ── KPI section ───────────────────────────────────────────────────────────────

async function KpiSection() {
  const supabase = await createServerClient();
  const { d30 } = cutoffs();

  const [revResult, cntResult, codesResult, custResult, arCntResult] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("doc_total")
        .gte("doc_date", d30)
        .eq("cancelled", false),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .gte("doc_date", d30)
        .eq("cancelled", false),
      supabase
        .from("invoices")
        .select("card_code")
        .gte("doc_date", d30)
        .eq("cancelled", false),
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("card_type", "C")
        .eq("valid", true),
      // Open invoice count is a separate metric ("across N open invoices")
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
    (s, r) => s + Number(r.doc_total ?? 0),
    0,
  );
  const invoiceCount = cntResult.count ?? 0;
  const activeCustomers = new Set(
    (codesResult.data ?? []).map((r) => r.card_code),
  ).size;
  const totalCustomers = custResult.count ?? 0;
  const arCount = arCntResult.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Revenue */}
      <Card className="border-emerald-100 bg-emerald-50">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Total Revenue (30d)
          </CardTitle>
          <CardAction>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {formatKES(revenue30d)}
          </p>
          <p className="mt-1 text-xs text-slate-400">last 30 days, invoiced</p>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card className="border-blue-100 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Invoices (30d)
          </CardTitle>
          <CardAction>
            <Receipt className="h-4 w-4 text-blue-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {invoiceCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">invoices raised</p>
        </CardContent>
      </Card>

      {/* Customers */}
      <Card className="border-purple-100 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-purple-700">
            Active Customers
          </CardTitle>
          <CardAction>
            <Users className="h-4 w-4 text-purple-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {activeCustomers.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            of {totalCustomers.toLocaleString()} total
          </p>
        </CardContent>
      </Card>

      {/* Outstanding AR */}
      <Card className="border-amber-100 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Outstanding AR
          </CardTitle>
          <CardAction>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {formatKES(arTotal)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            across {arCount.toLocaleString()} open invoices
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Revenue trend ─────────────────────────────────────────────────────────────

async function RevenueTrendSection() {
  const supabase = await createServerClient();
  const { d90 } = cutoffs();

  const { data: rows } = await supabase
    .from("invoices")
    .select("doc_date, doc_total")
    .gte("doc_date", d90)
    .eq("cancelled", false)
    .order("doc_date", { ascending: true });

  const byDate = new Map<string, number>();
  for (const r of rows ?? []) {
    const d = r.doc_date as string;
    byDate.set(d, (byDate.get(d) ?? 0) + Number(r.doc_total ?? 0));
  }
  const trendData = Array.from(byDate.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700">
          Revenue trend — last 90 days
        </CardTitle>
      </CardHeader>
      <CardContent>
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

  // Resolve customer names in a separate query (no FK join needed)
  const codes = [...new Set((rows ?? []).map((r) => r.card_code))];
  const { data: custRows } = codes.length
    ? await supabase
        .from("customers")
        .select("card_code, card_name")
        .in("card_code", codes)
    : { data: [] };
  const nameMap: Record<string, string> = {};
  for (const c of custRows ?? []) {
    if (c.card_code) nameMap[c.card_code] = (c.card_name as string | null) ?? c.card_code;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700">
          Recent Invoices
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-600">
                Doc #
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">
                Date
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">
                Customer
              </TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-600">
                Total
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-slate-400"
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
                  <TableCell className="text-sm text-slate-600">
                    {formatDate(inv.doc_date as string)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm font-medium text-slate-900">
                    {nameMap[inv.card_code] ?? inv.card_code}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {formatKESFull(Number(inv.doc_total ?? 0))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 text-xs",
                        inv.doc_status === "O"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700",
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
    .select("card_code, doc_total")
    .gte("doc_date", d30)
    .eq("cancelled", false);

  // Aggregate revenue per customer
  const totals = new Map<string, number>();
  for (const r of rows ?? []) {
    totals.set(r.card_code, (totals.get(r.card_code) ?? 0) + Number(r.doc_total ?? 0));
  }

  // Get top-10 codes, then resolve names separately
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
    if (c.card_code) nameMap[c.card_code] = (c.card_name as string | null) ?? c.card_code;
  }

  const topCustomers = topCodes.map((code) => ({
    card_name: nameMap[code] ?? code,
    total: totals.get(code) ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700">
          Top Customers — last 30 days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TopCustomersChart data={topCustomers} />
      </CardContent>
    </Card>
  );
}

// ── Sales Employee section ────────────────────────────────────────────────────

async function SalesEmployeeSection() {
  const supabase = await createServerClient();
  const { d30 } = cutoffs();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("invoices")
    .select("slp_name, doc_total")
    .gte("doc_date", d30)
    .lte("doc_date", todayStr)
    .eq("cancelled", false);

  const rows = data ?? [];
  const hasData = rows.some((r) => r.slp_name != null);

  if (!hasData) {
    return (
      <Card>
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
              (pending: column added, awaiting re-sync)
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  const map = new Map<string, number>();
  for (const r of rows) {
    const name = (r.slp_name as string | null) ?? "(unassigned)";
    map.set(name, (map.get(name) ?? 0) + Number(r.doc_total ?? 0));
  }
  const chartData = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([card_name, total]) => ({ card_name, total }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700">
          Revenue by Sales Employee (30d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TopCustomersChart data={chartData} />
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Commercial Overview
        </h1>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-slate-500">Live data from SAP Business One</p>
          <Suspense fallback={null}>
            <DataFreshnessNote />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<KpiGridSkeleton />}>
        <KpiSection />
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
