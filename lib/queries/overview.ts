import { unstable_cache } from "next/cache";
import { DASHBOARD_DATA_TAG, DASHBOARD_REVALIDATE_SECONDS } from "@/lib/cache";
import { format, subDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";

// Loaders for the overview page. Cached with the admin client because
// unstable_cache can't read request cookies.

function cutoffs() {
  const today = new Date();
  return {
    d30: format(subDays(today, 30), "yyyy-MM-dd"),
    d90: format(subDays(today, 90), "yyyy-MM-dd"),
    todayStr: format(today, "yyyy-MM-dd"),
  };
}

async function resolveCustomerNames(codes: string[]): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {};
  if (codes.length === 0) return nameMap;
  const { data: custRows } = await createAdminClient()
    .from("customers")
    .select("card_code, card_name")
    .in("card_code", codes);
  for (const c of custRows ?? []) {
    if (c.card_code) nameMap[c.card_code] = (c.card_name as string | null) ?? c.card_code;
  }
  return nameMap;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface OverviewKpis {
  revenue30d: number;
  invoiceCount: number;
  activeCustomers: number;
  totalCustomers: number;
  arCount: number;
  arTotal: number;
  latestDate: string | null;
}

export const getOverviewKpis = unstable_cache(
  async (): Promise<OverviewKpis> => {
    const supabase = createAdminClient();
    const { d30, todayStr } = cutoffs();

    const [invRows, cntResult, custResult, arCntResult, balRows, latestResult] =
      await Promise.all([
        fetchAllRows<{ card_code: string; doc_total: number; vat_sum: number }>("overview revenue", (from, to) =>
          supabase
            .from("invoices")
            .select("card_code, doc_total, vat_sum")
            .gte("doc_date", d30)
            .lte("doc_date", todayStr)
            .eq("cancelled", false)
            .order("doc_entry", { ascending: true })
            .range(from, to),
        ),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .gte("doc_date", d30)
          .lte("doc_date", todayStr)
          .eq("cancelled", false),
        // All customers, not just valid ones — invoiced customers can include
        // since-deactivated accounts, which made "active of total" exceed 100%.
        supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .eq("card_type", "C"),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("doc_status", "O")
          .eq("cancelled", false),
        // AR total — paginated SUM to clear PostgREST's 1000-row default cap
        fetchAllRows<{ balance: number }>("overview AR balance", (from, to) =>
          supabase
            .from("customers")
            .select("balance")
            .eq("card_type", "C")
            .eq("valid", true)
            .gt("balance", 0)
            .order("card_code", { ascending: true })
            .range(from, to),
        ),
        // Latest invoice date for freshness
        supabase
          .from("invoices")
          .select("doc_date")
          .eq("cancelled", false)
          .order("doc_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    return {
      revenue30d: invRows.reduce(
        (s, r) => s + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0),
        0,
      ),
      invoiceCount: cntResult.count ?? 0,
      activeCustomers: new Set(invRows.map((r) => r.card_code)).size,
      totalCustomers: custResult.count ?? 0,
      arCount: arCntResult.count ?? 0,
      arTotal: balRows.reduce((s, r) => s + Number(r.balance ?? 0), 0),
      latestDate: (latestResult.data?.doc_date as string | undefined) ?? null,
    };
  },
  ["overview-kpis"],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_DATA_TAG] },
);

// ── Revenue trend ─────────────────────────────────────────────────────────────

export const getRevenueTrend90d = unstable_cache(
  async (): Promise<{ date: string; revenue: number }[]> => {
    const supabase = createAdminClient();
    const { d90 } = cutoffs();

    const rows = await fetchAllRows<{ doc_date: string; doc_total: number; vat_sum: number }>("revenue trend", (from, to) =>
      supabase
        .from("invoices")
        .select("doc_date, doc_total, vat_sum")
        .gte("doc_date", d90)
        .eq("cancelled", false)
        .order("doc_date", { ascending: true })
        .order("doc_entry", { ascending: true })
        .range(from, to),
    );

    const byDate = new Map<string, number>();
    for (const r of rows) {
      const d = r.doc_date as string;
      byDate.set(d, (byDate.get(d) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0));
    }
    return Array.from(byDate.entries()).map(([date, revenue]) => ({ date, revenue }));
  },
  ["overview-revenue-trend"],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_DATA_TAG] },
);

// ── Recent invoices ───────────────────────────────────────────────────────────

export interface RecentInvoiceRow {
  doc_num: number | null;
  doc_date: string;
  card_code: string;
  card_name: string;
  doc_total: number;
  doc_status: string | null;
}

export const getRecentInvoices = unstable_cache(
  async (): Promise<RecentInvoiceRow[]> => {
    const { data: rows } = await createAdminClient()
      .from("invoices")
      .select("doc_num, doc_date, card_code, doc_total, doc_status")
      .eq("cancelled", false)
      .order("doc_date", { ascending: false })
      .limit(10);

    const nameMap = await resolveCustomerNames([...new Set((rows ?? []).map((r) => r.card_code as string))]);

    return (rows ?? []).map((r) => ({
      doc_num: r.doc_num as number | null,
      doc_date: r.doc_date as string,
      card_code: r.card_code as string,
      card_name: nameMap[r.card_code] ?? r.card_code,
      doc_total: Number(r.doc_total ?? 0),
      doc_status: r.doc_status as string | null,
    }));
  },
  ["overview-recent-invoices"],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_DATA_TAG] },
);

// ── Top customers ─────────────────────────────────────────────────────────────

export const getTopCustomers30d = unstable_cache(
  async (): Promise<{ card_name: string; total: number }[]> => {
    const supabase = createAdminClient();
    const { d30 } = cutoffs();

    const rows = await fetchAllRows<{ card_code: string; doc_total: number; vat_sum: number }>("top customers", (from, to) =>
      supabase
        .from("invoices")
        .select("card_code, doc_total, vat_sum")
        .gte("doc_date", d30)
        .eq("cancelled", false)
        .order("doc_entry", { ascending: true })
        .range(from, to),
    );

    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(
        r.card_code,
        (totals.get(r.card_code) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0),
      );
    }

    const topCodes = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code]) => code);

    const nameMap = await resolveCustomerNames(topCodes);

    return topCodes.map((code) => ({
      card_name: nameMap[code] ?? code,
      total: totals.get(code) ?? 0,
    }));
  },
  ["overview-top-customers"],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_DATA_TAG] },
);

// ── Sales employee ────────────────────────────────────────────────────────────

// Null when no invoice carries a sales employee yet (column awaiting re-sync).
export const getSalesEmployeeRevenue30d = unstable_cache(
  async (): Promise<{ card_name: string; total: number }[] | null> => {
    const supabase = createAdminClient();
    const { d30, todayStr } = cutoffs();

    const rows = await fetchAllRows<{ slp_name: string | null; doc_total: number; vat_sum: number }>("sales employee", (from, to) =>
      supabase
        .from("invoices")
        .select("slp_name, doc_total, vat_sum")
        .gte("doc_date", d30)
        .lte("doc_date", todayStr)
        .eq("cancelled", false)
        .order("doc_entry", { ascending: true })
        .range(from, to),
    );
    if (!rows.some((r) => r.slp_name != null)) return null;

    const map = new Map<string, number>();
    for (const r of rows) {
      const name = r.slp_name ?? "(unassigned)";
      map.set(name, (map.get(name) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([card_name, total]) => ({ card_name, total }));
  },
  ["overview-sales-employee"],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_DATA_TAG] },
);
