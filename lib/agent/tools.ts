/**
 * Agent tools — pure read functions the Claude agent can call.
 * Schema: Zod (source of truth) → JSON Schema for Anthropic API.
 * Handlers: query Supabase, aggregate in JS, return clean JSON.
 * All invoice queries filter cancelled=false and use doc_total (KES).
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

// Row limit guard — never return more than this from any tool.
const MAX_ROWS = 50;

// ── Schemas ───────────────────────────────────────────────────────────────────

const PeriodSchema = z.object({
  start: z.string().describe("ISO date yyyy-MM-dd"),
  end: z.string().describe("ISO date yyyy-MM-dd, inclusive"),
});

export const toolSchemas = {
  get_revenue_summary: z.object({
    period: PeriodSchema,
  }),

  get_top_customers: z.object({
    period: PeriodSchema,
    limit: z.number().int().min(1).max(MAX_ROWS).default(10),
  }),

  get_outstanding_ar: z.object({}),

  compare_periods: z.object({
    metric: z.enum(["revenue", "invoices"]),
    period_a: PeriodSchema,
    period_b: PeriodSchema,
  }),

  get_daily_revenue_trend: z.object({
    days: z.number().int().min(7).max(365).default(30),
  }),

  search_customers: z.object({
    query: z.string().min(2),
    limit: z.number().int().min(1).max(20).default(10),
  }),

  get_customer_detail: z.object({
    card_code: z.string(),
  }),

  get_recent_payments: z.object({
    limit: z.number().int().min(1).max(MAX_ROWS).default(10),
  }),

  get_sales_employee_breakdown: z.object({
    period: PeriodSchema,
  }),

  get_fast_moving_skus: z.object({
    days: z.number().int().min(7).max(365).default(30),
    limit: z.number().int().min(1).max(50).default(20),
  }),

  get_stock_position: z.object({
    whs_code: z.string().optional().describe("Filter by warehouse code"),
    limit: z.number().int().min(1).max(50).default(20),
  }),

  get_accounts_payable: z.object({}),

  get_ap_invoices_summary: z.object({
    period: PeriodSchema.optional().describe("Date range for AP invoices. Omit for all-time open invoices."),
    status: z.enum(["O", "C"]).optional().describe("O = open, C = closed/paid. Defaults to open."),
  }),

  get_open_purchase_orders: z.object({
    limit: z.number().int().min(1).max(50).default(20),
  }),
} as const;

export type ToolName = keyof typeof toolSchemas;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Fetch a card_name→code map for a list of card_codes.
async function resolveCustomerNames(
  db: DB,
  codes: string[],
): Promise<Record<string, string>> {
  if (codes.length === 0) return {};
  const { data } = await db
    .from("customers")
    .select("card_code, card_name")
    .in("card_code", codes.slice(0, MAX_ROWS));
  const map: Record<string, string> = {};
  for (const r of data ?? []) {
    if (r.card_code) map[r.card_code] = (r.card_name as string | null) ?? r.card_code;
  }
  return map;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export function createToolHandlers(db: DB) {
  return {
    // ── get_revenue_summary ─────────────────────────────────────────────────
    async get_revenue_summary(
      args: z.infer<typeof toolSchemas.get_revenue_summary>,
    ) {
      const { data } = await db
        .from("invoices")
        .select("doc_total, vat_sum, card_code")
        .gte("doc_date", args.period.start)
        .lte("doc_date", args.period.end)
        .eq("cancelled", false);

      const rows = data ?? [];
      const total_revenue_kes = rows.reduce(
        (s, r) => s + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0),
        0,
      );
      const unique_customers = new Set(rows.map((r) => r.card_code)).size;

      return {
        period: args.period,
        total_revenue_kes,
        invoice_count: rows.length,
        unique_customers,
      };
    },

    // ── get_top_customers ───────────────────────────────────────────────────
    async get_top_customers(
      args: z.infer<typeof toolSchemas.get_top_customers>,
    ) {
      const { data } = await db
        .from("invoices")
        .select("card_code, doc_total, vat_sum")
        .gte("doc_date", args.period.start)
        .lte("doc_date", args.period.end)
        .eq("cancelled", false);

      // Aggregate by customer
      const map = new Map<string, { total: number; count: number }>();
      for (const r of data ?? []) {
        const prev = map.get(r.card_code) ?? { total: 0, count: 0 };
        map.set(r.card_code, {
          total: prev.total + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0),
          count: prev.count + 1,
        });
      }

      const topCodes = Array.from(map.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, args.limit)
        .map(([code]) => code);

      const names = await resolveCustomerNames(db, topCodes);

      return {
        period: args.period,
        customers: topCodes.map((code) => ({
          card_code: code,
          card_name: names[code] ?? code,
          total_revenue_kes: map.get(code)!.total,
          invoice_count: map.get(code)!.count,
        })),
      };
    },

    // ── get_outstanding_ar ──────────────────────────────────────────────────
    async get_outstanding_ar(_args: z.infer<typeof toolSchemas.get_outstanding_ar>) {
      // Use SAP's authoritative per-customer balance (OCRD.Balance) — matches SAP UI.
      const [balResult, cntResult] = await Promise.all([
        db
          .from("customers")
          .select("card_code, card_name, balance")
          .eq("card_type", "C")
          .eq("valid", true)
          .gt("balance", 0)
          .order("balance", { ascending: false }),
        db
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("doc_status", "O")
          .eq("cancelled", false),
      ]);

      const rows = balResult.data ?? [];
      const total_ar_kes = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0);

      return {
        total_ar_kes,
        open_invoice_count: cntResult.count ?? 0,
        top_debtors: rows.slice(0, 10).map((r) => ({
          card_code: r.card_code,
          card_name: (r.card_name as string | null) ?? r.card_code,
          outstanding_kes: Number(r.balance ?? 0),
        })),
      };
    },

    // ── compare_periods ─────────────────────────────────────────────────────
    async compare_periods(args: z.infer<typeof toolSchemas.compare_periods>) {
      async function fetch(start: string, end: string) {
        const { data } = await db
          .from("invoices")
          .select("doc_total, vat_sum")
          .gte("doc_date", start)
          .lte("doc_date", end)
          .eq("cancelled", false);
        const rows = data ?? [];
        return {
          revenue: rows.reduce((s, r) => s + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0), 0),
          invoices: rows.length,
        };
      }

      const [a, b] = await Promise.all([
        fetch(args.period_a.start, args.period_a.end),
        fetch(args.period_b.start, args.period_b.end),
      ]);

      const val_a = a[args.metric];
      const val_b = b[args.metric];
      const abs_change = val_a - val_b;
      const pct_change = val_b !== 0 ? (abs_change / val_b) * 100 : null;

      return {
        metric: args.metric,
        period_a: { ...args.period_a, value: val_a },
        period_b: { ...args.period_b, value: val_b },
        abs_change,
        pct_change: pct_change !== null ? Math.round(pct_change * 10) / 10 : null,
        direction: abs_change > 0 ? "up" : abs_change < 0 ? "down" : "flat",
      };
    },

    // ── get_daily_revenue_trend ─────────────────────────────────────────────
    async get_daily_revenue_trend(
      args: z.infer<typeof toolSchemas.get_daily_revenue_trend>,
    ) {
      const start = new Date();
      start.setDate(start.getDate() - args.days);
      const startStr = start.toISOString().split("T")[0];

      const { data } = await db
        .from("invoices")
        .select("doc_date, doc_total, vat_sum")
        .gte("doc_date", startStr)
        .eq("cancelled", false)
        .order("doc_date", { ascending: true });

      // Group by date
      const byDate = new Map<string, number>();
      for (const r of data ?? []) {
        const d = r.doc_date as string;
        byDate.set(d, (byDate.get(d) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0));
      }

      const series = Array.from(byDate.entries()).map(([date, revenue_kes]) => ({
        date,
        revenue_kes,
      }));

      return {
        days: args.days,
        start: startStr,
        series,
        total_kes: series.reduce((s, r) => s + r.revenue_kes, 0),
        data_points: series.length,
      };
    },

    // ── search_customers ────────────────────────────────────────────────────
    async search_customers(args: z.infer<typeof toolSchemas.search_customers>) {
      const q = args.query.trim().toLowerCase();

      // PostgREST ilike for partial match
      const { data } = await db
        .from("customers")
        .select("card_code, card_name, country, currency")
        .or(`card_name.ilike.%${q}%,card_code.ilike.%${q}%`)
        .limit(args.limit);

      return {
        query: args.query,
        results: (data ?? []).map((r) => ({
          card_code: r.card_code,
          card_name: r.card_name,
          country: r.country,
          currency: r.currency,
        })),
        count: (data ?? []).length,
      };
    },

    // ── get_customer_detail ─────────────────────────────────────────────────
    async get_customer_detail(
      args: z.infer<typeof toolSchemas.get_customer_detail>,
    ) {
      const [custResult, invResult] = await Promise.all([
        db
          .from("customers")
          .select("card_code, card_name, country, currency, u_channel, u_cluster, balance")
          .eq("card_code", args.card_code)
          .maybeSingle(),
        db
          .from("invoices")
          .select("doc_num, doc_date, doc_total, doc_status")
          .eq("card_code", args.card_code)
          .eq("cancelled", false)
          .order("doc_date", { ascending: false })
          .limit(10),
      ]);

      const cust = custResult.data;
      const recentInvs = invResult.data ?? [];

      return {
        customer: cust,
        // AR from SAP's authoritative OCRD.Balance — matches SAP UI to the cent
        outstanding_ar_kes: Math.max(0, Number(cust?.balance ?? 0)),
        open_invoice_count: recentInvs.filter((r) => r.doc_status === "O").length,
        recent_invoices: recentInvs.map((r) => ({
          doc_num: r.doc_num,
          doc_date: r.doc_date,
          total_kes: Number(r.doc_total ?? 0),
          status: r.doc_status,
        })),
      };
    },

    // ── get_recent_payments ─────────────────────────────────────────────────
    async get_recent_payments(
      args: z.infer<typeof toolSchemas.get_recent_payments>,
    ) {
      const { data } = await db
        .from("payments")
        .select("card_code, doc_date, amount_kes")
        .order("doc_date", { ascending: false })
        .limit(args.limit);

      const codes = [...new Set((data ?? []).map((r) => r.card_code))];
      const names = await resolveCustomerNames(db, codes);

      return {
        payments: (data ?? []).map((r) => ({
          card_code: r.card_code,
          card_name: names[r.card_code] ?? r.card_code,
          doc_date: r.doc_date,
          amount_kes: Number(r.amount_kes ?? 0),
        })),
        count: (data ?? []).length,
      };
    },

    // ── get_fast_moving_skus ────────────────────────────────────────────────
    async get_fast_moving_skus(
      args: z.infer<typeof toolSchemas.get_fast_moving_skus>,
    ) {
      const now = new Date();
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const dNow = fmt(now);
      const dCurrent = fmt(new Date(now.getTime() - args.days * 86_400_000));
      const dPrior = fmt(new Date(now.getTime() - args.days * 2 * 86_400_000));

      const [currRes, priorRes] = await Promise.all([
        db.from("invoice_lines")
          .select("item_code, quantity, line_total")
          .gte("doc_date", dCurrent)
          .lte("doc_date", dNow),
        db.from("invoice_lines")
          .select("item_code, quantity")
          .gte("doc_date", dPrior)
          .lt("doc_date", dCurrent),
      ]);

      const currVol = new Map<string, number>();
      const currRev = new Map<string, number>();
      for (const r of currRes.data ?? []) {
        const code = r.item_code as string;
        currVol.set(code, (currVol.get(code) ?? 0) + Number(r.quantity ?? 0));
        currRev.set(code, (currRev.get(code) ?? 0) + Number(r.line_total ?? 0));
      }

      const priorVol = new Map<string, number>();
      for (const r of priorRes.data ?? []) {
        const code = r.item_code as string;
        priorVol.set(code, (priorVol.get(code) ?? 0) + Number(r.quantity ?? 0));
      }

      const topCodes = Array.from(currVol.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, args.limit)
        .map(([code]) => code);

      const itemMap = new Map<string, string | null>();
      if (topCodes.length > 0) {
        const { data: items } = await db.from("items")
          .select("item_code, item_name, inventory_uom")
          .in("item_code", topCodes);
        for (const it of items ?? [])
          itemMap.set(it.item_code as string, it.item_name as string | null);
      }

      const skus = topCodes.map((code) => {
        const vol = currVol.get(code) ?? 0;
        const rev = currRev.get(code) ?? 0;
        const priorV = priorVol.get(code) ?? 0;
        const trend_pct = priorV > 0
          ? Math.round(((vol - priorV) / priorV) * 1000) / 10
          : null;
        return {
          item_code: code,
          item_name: itemMap.get(code) ?? code,
          total_volume: vol,
          velocity_per_day: Math.round((vol / args.days) * 100) / 100,
          total_revenue_kes: rev,
          prior_period_volume: priorV,
          trend_pct,
        };
      });

      const noTrendCount = skus.filter((s) => s.trend_pct === null).length;
      return {
        period_days: args.days,
        skus,
        ...(noTrendCount > 0
          ? { note: `${noTrendCount} SKU(s) have no prior-period sales — trend shown as null (new or seasonal items).` }
          : {}),
      };
    },

    // ── get_sales_employee_breakdown ────────────────────────────────────────
    async get_sales_employee_breakdown(
      args: z.infer<typeof toolSchemas.get_sales_employee_breakdown>,
    ) {
      const { data } = await db
        .from("invoices")
        .select("slp_name, doc_total, vat_sum, paid_to_date_sys")
        .gte("doc_date", args.period.start)
        .lte("doc_date", args.period.end)
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

      const employees = Array.from(map.entries())
        .map(([slp_name, { rev, cnt, paid }]) => ({
          slp_name,
          revenue_kes: rev,
          invoice_count: cnt,
          paid_kes: paid,
          outstanding_kes: Math.max(0, rev - paid),
        }))
        .sort((a, b) => b.revenue_kes - a.revenue_kes);

      const hasData = employees.some((e) => e.slp_name !== "(unassigned)");

      return {
        period: args.period,
        employees,
        note: hasData
          ? undefined
          : "slp_name is NULL for all invoices in this period — sales employee data will populate after the next SAP sync.",
      };
    },

    // ── get_stock_position ──────────────────────────────────────────────────
    async get_stock_position(args: z.infer<typeof toolSchemas.get_stock_position>) {
      const { data: latestRow } = await db
        .from("stock_snapshots")
        .select("snapshot_at")
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRow) {
        return {
          snapshot_at: null,
          items: [],
          note: "No stock snapshots yet — run the sync agent on PROCHEMSVR to capture inventory positions.",
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db
        .from("stock_snapshots")
        .select("item_code, whs_code, on_hand, committed, available")
        .eq("snapshot_at", latestRow.snapshot_at);
      if (args.whs_code) q = q.eq("whs_code", args.whs_code);
      const { data } = await q;

      const map = new Map<string, { on_hand: number; available: number; warehouses: string[] }>();
      for (const r of data ?? []) {
        const code = r.item_code as string;
        const prev = map.get(code) ?? { on_hand: 0, available: 0, warehouses: [] };
        const whs = r.whs_code as string;
        map.set(code, {
          on_hand: prev.on_hand + Number(r.on_hand ?? 0),
          available: prev.available + Number(r.available ?? 0),
          warehouses: prev.warehouses.includes(whs) ? prev.warehouses : [...prev.warehouses, whs],
        });
      }

      const topCodes = Array.from(map.entries())
        .sort((a, b) => b[1].on_hand - a[1].on_hand)
        .slice(0, args.limit)
        .map(([code]) => code);

      const { data: items } = await db
        .from("items")
        .select("item_code, item_name, inventory_uom")
        .in("item_code", topCodes);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemMap = new Map((items ?? []).map((i: any) => [i.item_code as string, i]));

      return {
        snapshot_at: latestRow.snapshot_at,
        items: topCodes.map((code) => {
          const agg = map.get(code)!;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const item = itemMap.get(code) as any;
          return {
            item_code: code,
            item_name: (item?.item_name as string | null) ?? code,
            inventory_uom: (item?.inventory_uom as string | null) ?? null,
            on_hand: agg.on_hand,
            available: agg.available,
            warehouse_count: agg.warehouses.length,
          };
        }),
      };
    },

    // ── get_accounts_payable ────────────────────────────────────────────────
    async get_accounts_payable(
      _args: z.infer<typeof toolSchemas.get_accounts_payable>
    ) {
      const [balResult, apCountResult] = await Promise.all([
        db
          .from("suppliers")
          .select("card_code, card_name, balance")
          .eq("valid", true)
          .gt("balance", 0)
          .order("balance", { ascending: false }),
        db
          .from("ap_invoices")
          .select("*", { count: "exact", head: true })
          .eq("doc_status", "O")
          .eq("cancelled", false),
      ]);

      const suppliers = balResult.data ?? [];
      const totalPayables = suppliers.reduce((s, r) => s + Number(r.balance ?? 0), 0);

      return {
        total_payables_kes: totalPayables,
        supplier_count: suppliers.length,
        open_ap_invoice_count: apCountResult.count ?? 0,
        top_creditors: suppliers.slice(0, 10).map((r) => ({
          card_code: r.card_code,
          card_name: (r.card_name as string | null) ?? r.card_code,
          balance_kes: Number(r.balance ?? 0),
        })),
        note:
          suppliers.length === 0
            ? "No supplier data yet — run the sync to populate the suppliers table from SAP OCRD."
            : undefined,
      };
    },

    // ── get_ap_invoices_summary ─────────────────────────────────────────────
    async get_ap_invoices_summary(
      args: z.infer<typeof toolSchemas.get_ap_invoices_summary>
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db
        .from("ap_invoices")
        .select("doc_total, paid_to_date, card_code, doc_date, doc_status")
        .eq("cancelled", false);

      const status = args.status ?? "O";
      q = q.eq("doc_status", status);

      if (args.period) {
        q = q.gte("doc_date", args.period.start).lte("doc_date", args.period.end);
      }

      const { data } = await q;
      const rows = (data ?? []) as Array<Record<string, unknown>>;

      let totalAmount = 0;
      let totalOutstanding = 0;
      const bySupplier = new Map<string, { amount: number; count: number }>();

      for (const r of rows) {
        const amt = Number(r.doc_total ?? 0);
        const paid = Number(r.paid_to_date ?? 0);
        const outstanding = Math.max(0, amt - paid);
        totalAmount += amt;
        totalOutstanding += outstanding;
        const cc = r.card_code as string;
        const prev = bySupplier.get(cc) ?? { amount: 0, count: 0 };
        bySupplier.set(cc, { amount: prev.amount + outstanding, count: prev.count + 1 });
      }

      const topSuppliers = Array.from(bySupplier.entries())
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 10)
        .map(([card_code, { amount, count }]) => ({ card_code, outstanding_kes: amount, invoice_count: count }));

      return {
        status,
        period: args.period ?? "all-time",
        invoice_count: rows.length,
        total_amount_kes: totalAmount,
        total_outstanding_kes: totalOutstanding,
        top_suppliers_by_outstanding: topSuppliers,
      };
    },

    // ── get_open_purchase_orders ────────────────────────────────────────────
    async get_open_purchase_orders(
      args: z.infer<typeof toolSchemas.get_open_purchase_orders>
    ) {
      const { data } = await db
        .from("purchase_orders")
        .select("doc_entry, doc_num, card_code, doc_date, doc_due_date, doc_total, doc_currency")
        .eq("doc_status", "O")
        .eq("cancelled", false)
        .order("doc_total", { ascending: false })
        .limit(args.limit);

      const rows = data ?? [];
      const totalValue = rows.reduce((s, r) => s + Number(r.doc_total ?? 0), 0);

      return {
        open_po_count: rows.length,
        total_value_kes: totalValue,
        purchase_orders: rows.map((r) => ({
          doc_num: r.doc_num ?? r.doc_entry,
          card_code: r.card_code,
          doc_date: r.doc_date,
          doc_due_date: r.doc_due_date,
          doc_total_kes: Number(r.doc_total ?? 0),
          doc_currency: r.doc_currency,
        })),
        note:
          rows.length === 0
            ? "No open purchase orders — either none exist in SAP or the sync has not run yet."
            : undefined,
      };
    },
  };
}

// ── Anthropic tool definitions ────────────────────────────────────────────────

const descriptions: Record<ToolName, string> = {
  get_revenue_summary:
    "Total revenue (KES), invoice count, and unique customer count for a date period. Use this first for any revenue question.",
  get_top_customers:
    "Top N customers ranked by revenue in a period. Returns code, name, total revenue, and invoice count.",
  get_outstanding_ar:
    "Total open accounts receivable in KES, count of open invoices, and top 10 debtors by balance.",
  compare_periods:
    "Compare revenue or invoice count between two periods. Returns absolute and % change.",
  get_daily_revenue_trend:
    "Daily revenue series for the last N days. Use for trend questions or when a chart would help.",
  search_customers:
    "Search customers by name or code (partial match). Use before get_customer_detail when the user gives a name instead of a code.",
  get_customer_detail:
    "Full profile for one customer: info, last 10 invoices, open AR balance.",
  get_recent_payments:
    "Most recent N payments received, with customer names and amounts.",
  get_sales_employee_breakdown:
    "Revenue, invoice count, and outstanding AR per sales employee for a period. Returns '(unassigned)' rows when slp_name is not yet synced.",
  get_fast_moving_skus:
    "Top N SKUs ranked by sales volume over the last N days, with velocity (units/day), product revenue, and % trend vs the equivalent prior period. Use for questions about fastest-moving products, trending items, or SKU velocity.",
  get_stock_position:
    "Current on-hand, committed, and available inventory per SKU from the latest SAP OITW snapshot. Optionally filter by warehouse code. Returns empty with a note if no snapshot exists yet.",
  get_accounts_payable:
    "Total payables balance across all suppliers, count of open A/P invoices, and top 10 creditors by SAP OCRD balance. Use for questions about what Prochem owes suppliers.",
  get_ap_invoices_summary:
    "Summary of A/P invoices (from OPCH): invoice count, total amount, outstanding balance, and top suppliers by outstanding. Filter by status (O=open, C=closed) and optional date range.",
  get_open_purchase_orders:
    "Open purchase orders from SAP OPOR, ranked by value. Returns count, total committed value, and individual PO details. Use for questions about pending procurement.",
};

export function getToolsForAnthropic() {
  return (Object.keys(toolSchemas) as ToolName[]).map((name) => ({
    name,
    description: descriptions[name],
    // z.toJSONSchema is Zod v4's built-in converter; avoids zod-to-json-schema v3/v4 mismatch.
    input_schema: z.toJSONSchema(toolSchemas[name]) as Record<string, unknown> & {
      type: "object";
    },
  }));
}
