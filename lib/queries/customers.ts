import { unstable_cache } from "next/cache";
import { z } from "zod";
import { format, subDays, subMonths, differenceInDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";

// ── Input schemas ─────────────────────────────────────────────────────────────

const listInputSchema = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  activeOnly: z.boolean().default(true),
  sort: z.enum(["name", "revenue30d", "ar", "lastOrder"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type ListCustomersInput = z.input<typeof listInputSchema>;

// ── Row types ─────────────────────────────────────────────────────────────────

export interface CustomerRow {
  card_code: string;
  card_name: string | null;
  country: string | null;
  currency: string | null;
  valid: boolean | null;
  sap_create_date: string | null;
  revenue30d: number;
  revenue12mo: number;
  ar: number;
  last_order_date: string | null;
}

export interface CustomerDetail {
  card_code: string;
  card_name: string | null;
  card_type: string | null;
  country: string | null;
  currency: string | null;
  credit_line: number | null;
  balance: number | null;
  valid: boolean | null;
  u_cluster: string | null;
  u_channel: string | null;
  sap_create_date: string | null;
  totalInvoices: number;
  revenue12mo: number;
  ar: number;
  last_order_date: string | null;
  last_payment_date: string | null;
}

export interface RevenueTrendRow {
  month: string;
  revenue_kes: number;
  invoice_count: number;
}

export interface ARAging {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
}

export interface InvoiceRow {
  doc_entry: number;
  doc_num: number | null;
  doc_date: string;
  doc_total: number;
  paid_to_date_sys: number;
  doc_status: string | null;
  card_code: string;
}

export interface PaymentRow {
  doc_entry: number;
  doc_date: string;
  doc_total: number;
  doc_currency: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date();
}

// ── listCustomers ─────────────────────────────────────────────────────────────

export const listCustomers = unstable_cache(
  async (input: ListCustomersInput) => {
    const f = listInputSchema.parse(input ?? {});
    const supabase = createAdminClient();

    const d30 = format(subDays(today(), 30), "yyyy-MM-dd");
    const d12mo = format(subMonths(today(), 12), "yyyy-MM-dd");
    const pageStart = (f.page - 1) * f.pageSize;

    // Apply user-controlled filters to a query base (after .from/.select/.eq card_type)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function af(q: any): any {
      if (f.activeOnly) q = q.eq("valid", true);
      if (f.search) q = q.or(`card_name.ilike.%${f.search}%,card_code.ilike.%${f.search}%`);
      if (f.country) q = q.eq("country", f.country);
      return q;
    }

    // ── 1. Exact count (never use data.length — PostgREST caps at 1000) ──────
    const { count: exactCount } = await af(
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("card_type", "C")
    );
    const total = exactCount ?? 0;
    if (total === 0) return { rows: [] as CustomerRow[], total: 0, arTotal: 0 };

    // ── 2. AR total — paginated SUM across ALL matching customers ─────────────
    // Each loop fetches 1000 rows to clear PostgREST's default row cap.
    let arTotal = 0;
    for (let page = 0; page < 200; page++) {
      const { data: balPage } = await af(
        supabase.from("customers").select("balance").eq("card_type", "C").gt("balance", 0)
      ).range(page * 1000, (page + 1) * 1000 - 1);
      const balRows = balPage ?? [];
      for (const r of balRows) arTotal += Number(r.balance ?? 0);
      if (balRows.length < 1000) break;
    }

    // ── 3. Customer rows for this page ────────────────────────────────────────
    const ascending = f.sortDir === "asc";
    let customers: Array<Record<string, unknown>>;

    if (f.sort === "ar" || f.sort === "name") {
      // Push sort + pagination entirely to the DB — no JS sort needed.
      const orderCol = f.sort === "ar" ? "balance" : "card_name";
      const { data, error } = await af(
        supabase
          .from("customers")
          .select("card_code, card_name, country, currency, valid, sap_create_date, balance")
          .eq("card_type", "C")
      )
        .order(orderCol, { ascending, nullsFirst: false })
        .range(pageStart, pageStart + f.pageSize - 1);
      if (error) throw new Error(`listCustomers: ${error.message}`);
      customers = (data ?? []) as Array<Record<string, unknown>>;
    } else {
      // JS-side sort (revenue30d, lastOrder) — fetch all (5000 cap) then sort + slice.
      const { data, error } = await af(
        supabase
          .from("customers")
          .select("card_code, card_name, country, currency, valid, sap_create_date, balance")
          .eq("card_type", "C")
      ).limit(5000);
      if (error) throw new Error(`listCustomers: ${error.message}`);
      customers = (data ?? []) as Array<Record<string, unknown>>;
    }

    if (customers.length === 0) return { rows: [] as CustomerRow[], total, arTotal };

    const codes = customers.map((c) => c.card_code as string);

    // ── 4. Invoice aggregates for visible customers (chunked to stay under URL length) ──
    const chunk = (arr: string[], n: number) => {
      const out: string[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function fetchInvoiceCols(select: string, extra?: (q: any) => any) {
      const allRows: Record<string, unknown>[] = [];
      for (const batch of chunk(codes, 200)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bq: any = supabase.from("invoices").select(select).in("card_code", batch).eq("cancelled", false);
        if (extra) bq = extra(bq);
        const { data } = await bq;
        allRows.push(...(data ?? []));
      }
      return allRows;
    }

    const [rev30Rows, rev12Rows, lastOrderRows] = await Promise.all([
      fetchInvoiceCols("card_code, doc_total, vat_sum", (q) => q.gte("doc_date", d30)),
      fetchInvoiceCols("card_code, doc_total, vat_sum", (q) => q.gte("doc_date", d12mo)),
      fetchInvoiceCols("card_code, doc_date", (q) => q.order("doc_date", { ascending: false })),
    ]);

    // ── 5. Aggregate by customer code ─────────────────────────────────────────
    const rev30Map = new Map<string, number>();
    for (const r of rev30Rows) {
      const cc = r.card_code as string;
      rev30Map.set(cc, (rev30Map.get(cc) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0));
    }

    const rev12Map = new Map<string, number>();
    for (const r of rev12Rows) {
      const cc = r.card_code as string;
      rev12Map.set(cc, (rev12Map.get(cc) ?? 0) + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0));
    }

    const lastOrderMap = new Map<string, string>();
    for (const r of lastOrderRows) {
      const cc = r.card_code as string;
      if (!lastOrderMap.has(cc)) lastOrderMap.set(cc, r.doc_date as string);
    }

    // ── 6. Build rows ─────────────────────────────────────────────────────────
    let rows: CustomerRow[] = customers.map((c) => ({
      card_code: c.card_code as string,
      card_name: c.card_name as string | null,
      country: c.country as string | null,
      currency: c.currency as string | null,
      valid: c.valid as boolean | null,
      sap_create_date: c.sap_create_date as string | null,
      revenue30d: rev30Map.get(c.card_code as string) ?? 0,
      revenue12mo: rev12Map.get(c.card_code as string) ?? 0,
      ar: Math.max(0, Number(c.balance ?? 0)),
      last_order_date: lastOrderMap.get(c.card_code as string) ?? null,
    }));

    // ── 7. JS-side sort + slice (only for non-DB-sorted cases) ───────────────
    if (f.sort === "revenue30d" || f.sort === "lastOrder") {
      const dir = ascending ? 1 : -1;
      rows.sort((a, b) => {
        if (f.sort === "revenue30d") return dir * (a.revenue30d - b.revenue30d);
        return dir * (a.last_order_date ?? "").localeCompare(b.last_order_date ?? "");
      });
      rows = rows.slice(pageStart, pageStart + f.pageSize);
    }

    return { rows, total, arTotal };
  },
  ["customers-list"],
  { revalidate: 60 },
);

// ── getCustomerDetail ─────────────────────────────────────────────────────────

export const getCustomerDetail = unstable_cache(
  async (card_code: string): Promise<CustomerDetail | null> => {
    const supabase = createAdminClient();
    const d12mo = format(subMonths(today(), 12), "yyyy-MM-dd");

    const [custResult, invResult, payResult] = await Promise.all([
      supabase.from("customers").select("*").eq("card_code", card_code).maybeSingle(),
      supabase.from("invoices").select("doc_total, vat_sum, doc_date").eq("card_code", card_code).eq("cancelled", false).gte("doc_date", d12mo),
      supabase.from("payments").select("doc_date").eq("card_code", card_code).eq("cancelled", false).order("doc_date", { ascending: false }).limit(1),
    ]);

    const cust = custResult.data;
    if (!cust) return null;

    const inv12 = invResult.data ?? [];

    const revenue12mo = inv12.reduce((s, r) => s + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0), 0);
    // AR from SAP's authoritative OCRD.Balance — matches SAP UI to the cent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ar = Math.max(0, Number((cust as any).balance ?? 0));

    const dates = inv12.map((r) => r.doc_date as string).sort();
    const last_order_date = dates.length ? dates[dates.length - 1] : null;
    const last_payment_date = (payResult.data ?? [])[0]?.doc_date as string | null ?? null;

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(cust as any),
      totalInvoices: inv12.length,
      revenue12mo,
      ar,
      last_order_date,
      last_payment_date,
    };
  },
  ["customers-detail"],
  { revalidate: 120 },
);

// ── getCustomerRevenueTrend ───────────────────────────────────────────────────

export const getCustomerRevenueTrend = unstable_cache(
  async (card_code: string, months = 12): Promise<RevenueTrendRow[]> => {
    const supabase = createAdminClient();
    const start = format(subMonths(today(), months), "yyyy-MM-dd");

    const { data } = await supabase
      .from("invoices")
      .select("doc_date, doc_total, vat_sum")
      .eq("card_code", card_code)
      .eq("cancelled", false)
      .gte("doc_date", start);

    const byMonth = new Map<string, { rev: number; cnt: number }>();
    for (const r of data ?? []) {
      const m = (r.doc_date as string).slice(0, 7);
      const prev = byMonth.get(m) ?? { rev: 0, cnt: 0 };
      byMonth.set(m, { rev: prev.rev + Number(r.doc_total ?? 0) - Number(r.vat_sum ?? 0), cnt: prev.cnt + 1 });
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { rev, cnt }]) => ({ month, revenue_kes: rev, invoice_count: cnt }));
  },
  ["customers-revenue-trend"],
  { revalidate: 300 },
);

// ── getCustomerARAging ────────────────────────────────────────────────────────

export const getCustomerARAging = unstable_cache(
  async (card_code: string): Promise<ARAging> => {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("invoices")
      .select("doc_total, paid_to_date_sys, doc_due_date, doc_date")
      .eq("card_code", card_code)
      .eq("doc_status", "O")
      .eq("cancelled", false);

    const now = today();
    const aging: ARAging = { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 };

    for (const r of data ?? []) {
      const outstanding = Math.max(0, Number(r.doc_total ?? 0) - Number(r.paid_to_date_sys ?? 0));
      if (outstanding <= 0) continue;
      const dueDate = r.doc_due_date ? new Date((r.doc_due_date as string) + "T00:00:00") : new Date((r.doc_date as string) + "T00:00:00");
      const daysPastDue = differenceInDays(now, dueDate);
      aging.total += outstanding;
      if (daysPastDue <= 30) aging.b0_30 += outstanding;
      else if (daysPastDue <= 60) aging.b31_60 += outstanding;
      else if (daysPastDue <= 90) aging.b61_90 += outstanding;
      else aging.b90_plus += outstanding;
    }

    return aging;
  },
  ["customers-ar-aging"],
  { revalidate: 60 },
);

// ── getCustomerRecentInvoices ─────────────────────────────────────────────────

export const getCustomerRecentInvoices = unstable_cache(
  async (card_code: string, limit = 20): Promise<InvoiceRow[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("invoices")
      .select("doc_entry, doc_num, doc_date, doc_total, paid_to_date_sys, doc_status, card_code")
      .eq("card_code", card_code)
      .eq("cancelled", false)
      .order("doc_date", { ascending: false })
      .limit(limit);
    return (data ?? []) as InvoiceRow[];
  },
  ["customers-recent-invoices"],
  { revalidate: 60 },
);

// ── getCustomerRecentPayments ─────────────────────────────────────────────────

export const getCustomerRecentPayments = unstable_cache(
  async (card_code: string, limit = 20): Promise<PaymentRow[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("payments")
      .select("doc_entry, doc_date, doc_total, doc_currency")
      .eq("card_code", card_code)
      .eq("cancelled", false)
      .order("doc_date", { ascending: false })
      .limit(limit);
    return (data ?? []) as PaymentRow[];
  },
  ["customers-recent-payments"],
  { revalidate: 60 },
);

// ── getCustomerCountries ──────────────────────────────────────────────────────

export const getCustomerCountries = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("customers")
      .select("country")
      .eq("card_type", "C")
      .eq("valid", true)
      .not("country", "is", null);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.country) set.add(r.country as string);
    return Array.from(set).sort();
  },
  ["customers-countries"],
  { revalidate: 600 },
);
