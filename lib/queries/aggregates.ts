import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export interface ARAging {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
  open_count: number;
}

export interface PeriodRevenue {
  total_revenue: number;
  invoice_count: number;
  unique_customers: number;
}

// ── arAgingBuckets ────────────────────────────────────────────────────────────
//
// Verification SQL (run in Supabase SQL editor to cross-check KPIs):
//
// -- Total AR (verify against Overview KPI):
// SELECT SUM(balance) FROM customers WHERE card_type='C' AND valid=true AND balance > 0;
//
// -- Top 10 debtors (verify against /customers sorted by AR descending):
// SELECT card_code, card_name, balance FROM customers
// WHERE card_type='C' AND valid=true AND balance > 0
// ORDER BY balance DESC LIMIT 10;

export const arAgingBuckets = unstable_cache(
  async (): Promise<ARAging> => {
    const supabase = createAdminClient();

    // Total AR comes from SAP's authoritative per-customer balance (OCRD.Balance).
    // Aging buckets are still derived from open invoices — the best proxy we have
    // for aging breakdown since OCRD.Balance has no bucket detail.

    // Paginated SUM of customer balances — loops in 1000-row pages to clear PostgREST cap.
    let total = 0;
    for (let page = 0; page < 200; page++) {
      const { data: balPage } = await supabase
        .from("customers")
        .select("balance")
        .eq("card_type", "C")
        .eq("valid", true)
        .gt("balance", 0)
        .range(page * 1000, (page + 1) * 1000 - 1);
      const balRows = balPage ?? [];
      for (const r of balRows) total += Number(r.balance ?? 0);
      if (balRows.length < 1000) break;
    }

    const [invResult, cntResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("doc_total, paid_to_date_sys, doc_due_date, doc_date")
        .eq("doc_status", "O")
        .eq("cancelled", false),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("doc_status", "O")
        .eq("cancelled", false),
    ]);

    const now = new Date();
    const result: ARAging = {
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b90_plus: 0,
      total,
      open_count: cntResult.count ?? 0,
    };

    for (const r of invResult.data ?? []) {
      const outstanding = Math.max(0, Number(r.doc_total ?? 0) - Number(r.paid_to_date_sys ?? 0));
      if (outstanding <= 0) continue;
      const dueDate = r.doc_due_date
        ? new Date((r.doc_due_date as string) + "T00:00:00")
        : new Date((r.doc_date as string) + "T00:00:00");
      const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
      if (days <= 30) result.b0_30 += outstanding;
      else if (days <= 60) result.b31_60 += outstanding;
      else if (days <= 90) result.b61_90 += outstanding;
      else result.b90_plus += outstanding;
    }

    return result;
  },
  ["aggregates-ar-aging"],
  { revalidate: 60 },
);

// ── getSalesEmployeeRollup ────────────────────────────────────────────────────

export interface SalesEmployeeRow {
  slp_name: string;
  revenue_kes: number;
  invoice_count: number;
  paid_kes: number;
  outstanding_kes: number;
}

export const getSalesEmployeeRollup = unstable_cache(
  async (period: { start: string; end: string }): Promise<SalesEmployeeRow[]> => {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("invoices")
      .select("slp_name, doc_total, vat_sum, paid_to_date_sys")
      .gte("doc_date", period.start)
      .lte("doc_date", period.end)
      .eq("cancelled", false);

    const map = new Map<string, { rev: number; cnt: number; paid: number }>();
    for (const r of data ?? []) {
      const name = (r.slp_name as string | null) ?? "(unassigned)";
      const prev = map.get(name) ?? { rev: 0, cnt: 0, paid: 0 };
      map.set(name, {
        rev: prev.rev + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0),
        cnt: prev.cnt + 1,
        paid: prev.paid + Number(r.paid_to_date_sys ?? 0),
      });
    }

    return Array.from(map.entries())
      .map(([slp_name, { rev, cnt, paid }]) => ({
        slp_name,
        revenue_kes: rev,
        invoice_count: cnt,
        paid_kes: paid,
        outstanding_kes: Math.max(0, rev - paid),
      }))
      .sort((a, b) => b.revenue_kes - a.revenue_kes);
  },
  ["aggregates-sales-employee-rollup"],
  { revalidate: 300 },
);

// ── revenueByPeriod ───────────────────────────────────────────────────────────

export const revenueByPeriod = unstable_cache(
  async (start: string, end: string): Promise<PeriodRevenue> => {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("invoices")
      .select("doc_total, vat_sum, card_code")
      .gte("doc_date", start)
      .lte("doc_date", end)
      .eq("cancelled", false);

    const rows = data ?? [];
    return {
      total_revenue: rows.reduce((s, r) => s + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0), 0),
      invoice_count: rows.length,
      unique_customers: new Set(rows.map((r) => r.card_code)).size,
    };
  },
  ["aggregates-revenue-by-period"],
  { revalidate: 300 },
);
