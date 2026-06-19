import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

// ── Input schema ──────────────────────────────────────────────────────────────

const listInputSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(["O", "C", "all"]).default("all"),
  customerSearch: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  sort: z.enum(["date", "amount", "customer"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type ListInvoicesInput = z.input<typeof listInputSchema>;

// ── Row types ─────────────────────────────────────────────────────────────────

export interface InvoiceListRow {
  doc_entry: number;
  doc_num: number | null;
  doc_date: string;
  doc_due_date: string | null;
  card_code: string;
  card_name: string | null;
  doc_currency: string | null;
  doc_total: number;
  paid_to_date_sys: number;
  outstanding: number;
  doc_status: string | null;
  age_days: number | null;
}

export interface InvoiceTotals {
  sum_kes: number;
  open_count: number;
  open_sum_kes: number;
  filtered_count: number;
}

export interface InvoiceDetail {
  doc_entry: number;
  doc_num: number | null;
  doc_date: string;
  doc_due_date: string | null;
  card_code: string;
  card_name: string | null;
  doc_currency: string | null;
  doc_rate: number | null;
  doc_total: number;
  paid_to_date_sys: number;
  outstanding: number;
  doc_status: string | null;
}

export interface InvoiceLineRow {
  line_num: number;
  item_code: string;
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  line_total: number;
}

// ── listInvoices ──────────────────────────────────────────────────────────────

export const listInvoices = unstable_cache(
  async (input: ListInvoicesInput) => {
    const f = listInputSchema.parse(input ?? {});
    const supabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("invoices")
      .select("doc_entry, doc_num, doc_date, doc_due_date, card_code, doc_currency, doc_total, paid_to_date_sys, doc_status")
      .eq("cancelled", false);

    if (f.dateFrom) q = q.gte("doc_date", f.dateFrom);
    if (f.dateTo)   q = q.lte("doc_date", f.dateTo);
    if (f.status !== "all") q = q.eq("doc_status", f.status);

    const { data: invData, error } = await q;
    if (error) throw new Error(`listInvoices: ${error.message}`);

    const rows = invData ?? [];

    // Resolve customer names (two-step, no FK join)
    const codes = [...new Set(rows.map((r: { card_code: string }) => r.card_code))];
    const nameMap: Record<string, string | null> = {};
    if (codes.length > 0) {
      for (let i = 0; i < codes.length; i += 200) {
        const { data: custData } = await supabase
          .from("customers")
          .select("card_code, card_name")
          .in("card_code", codes.slice(i, i + 200));
        for (const c of custData ?? []) nameMap[c.card_code] = c.card_name as string | null;
      }
    }

    const now = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type EnrichedRow = (typeof rows)[number] & { card_name: string | null; outstanding: number; age_days: number | null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enriched: EnrichedRow[] = (rows as any[]).map((r) => {
      const outstanding = Math.max(0, Number(r.doc_total ?? 0) - Number(r.paid_to_date_sys ?? 0));
      const ageDays = r.doc_status === "O" && r.doc_due_date
        ? Math.floor((now.getTime() - new Date((r.doc_due_date as string) + "T00:00:00").getTime()) / 86_400_000)
        : null;
      return { ...r, card_name: nameMap[r.card_code] ?? null, outstanding, age_days: ageDays };
    });

    if (f.customerSearch) {
      const q2 = f.customerSearch.toLowerCase();
      enriched = enriched.filter(
        (r) =>
          (r.card_name ?? "").toLowerCase().includes(q2) ||
          r.card_code.toLowerCase().includes(q2),
      );
    }
    if (f.minAmount != null) enriched = enriched.filter((r) => Number(r.doc_total) >= f.minAmount!);
    if (f.maxAmount != null) enriched = enriched.filter((r) => Number(r.doc_total) <= f.maxAmount!);

    const totals: InvoiceTotals = {
      sum_kes: enriched.reduce((s, r) => s + Number(r.doc_total ?? 0), 0),
      open_count: enriched.filter((r) => r.doc_status === "O").length,
      open_sum_kes: enriched.filter((r) => r.doc_status === "O").reduce((s, r) => s + r.outstanding, 0),
      filtered_count: enriched.length,
    };

    const dir = f.sortDir === "desc" ? -1 : 1;
    enriched.sort((a, b) => {
      switch (f.sort) {
        case "amount":   return dir * (Number(a.doc_total) - Number(b.doc_total));
        case "customer": return dir * (a.card_name ?? a.card_code).localeCompare(b.card_name ?? b.card_code);
        default:         return dir * (a.doc_date as string).localeCompare(b.doc_date as string);
      }
    });

    const total = enriched.length;
    const start = (f.page - 1) * f.pageSize;
    const pageRows: InvoiceListRow[] = enriched
      .slice(start, start + f.pageSize)
      .map((r) => ({
        doc_entry: r.doc_entry,
        doc_num: r.doc_num,
        doc_date: r.doc_date as string,
        doc_due_date: r.doc_due_date as string | null,
        card_code: r.card_code,
        card_name: r.card_name,
        doc_currency: r.doc_currency as string | null,
        doc_total: Number(r.doc_total ?? 0),
        paid_to_date_sys: Number(r.paid_to_date_sys ?? 0),
        outstanding: r.outstanding,
        doc_status: r.doc_status as string | null,
        age_days: r.age_days,
      }));

    return { rows: pageRows, total, totals };
  },
  ["invoices-list"],
  { revalidate: 60 },
);

// ── getInvoiceDetail ──────────────────────────────────────────────────────────

export const getInvoiceDetail = unstable_cache(
  async (doc_entry: number): Promise<InvoiceDetail | null> => {
    const supabase = createAdminClient();

    const { data: inv } = await supabase
      .from("invoices")
      .select("doc_entry, doc_num, doc_date, doc_due_date, card_code, doc_currency, doc_rate, doc_total, paid_to_date_sys, doc_status")
      .eq("doc_entry", doc_entry)
      .maybeSingle();

    if (!inv) return null;

    const { data: cust } = await supabase
      .from("customers")
      .select("card_name")
      .eq("card_code", inv.card_code)
      .maybeSingle();

    const outstanding = Math.max(0, Number(inv.doc_total ?? 0) - Number(inv.paid_to_date_sys ?? 0));

    return {
      doc_entry: inv.doc_entry,
      doc_num: inv.doc_num,
      doc_date: inv.doc_date as string,
      doc_due_date: inv.doc_due_date as string | null,
      card_code: inv.card_code,
      card_name: (cust?.card_name as string | null) ?? null,
      doc_currency: inv.doc_currency as string | null,
      doc_rate: inv.doc_rate as number | null,
      doc_total: Number(inv.doc_total ?? 0),
      paid_to_date_sys: Number(inv.paid_to_date_sys ?? 0),
      outstanding,
      doc_status: inv.doc_status as string | null,
    };
  },
  ["invoices-detail"],
  { revalidate: 120 },
);

// ── getInvoiceLines ───────────────────────────────────────────────────────────

export const getInvoiceLines = unstable_cache(
  async (doc_entry: number): Promise<InvoiceLineRow[]> => {
    const supabase = createAdminClient();

    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("line_num, item_code, quantity, price, line_total")
      .eq("doc_entry", doc_entry)
      .order("line_num", { ascending: true });

    if (!lines || lines.length === 0) return [];

    const itemCodes = [...new Set(lines.map((l) => l.item_code as string))];
    const { data: items } = await supabase
      .from("items")
      .select("item_code, item_name")
      .in("item_code", itemCodes);

    const itemMap: Record<string, string | null> = {};
    for (const it of items ?? []) itemMap[it.item_code as string] = it.item_name as string | null;

    return lines.map((l) => ({
      line_num: l.line_num as number,
      item_code: l.item_code as string,
      item_name: itemMap[l.item_code as string] ?? null,
      quantity: l.quantity as number | null,
      price: l.price as number | null,
      line_total: Number(l.line_total ?? 0),
    }));
  },
  ["invoices-lines"],
  { revalidate: 300 },
);

// ── getPaymentsNearInvoice ────────────────────────────────────────────────────

export const getPaymentsNearInvoice = unstable_cache(
  async (card_code: string, doc_date: string, limit = 10) => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("payments")
      .select("doc_entry, doc_date, doc_total, doc_currency")
      .eq("card_code", card_code)
      .eq("cancelled", false)
      .gte("doc_date", doc_date)
      .order("doc_date", { ascending: true })
      .limit(limit);
    return (data ?? []).map((p) => ({
      doc_entry: p.doc_entry as number,
      doc_date: p.doc_date as string,
      doc_total: Number(p.doc_total ?? 0),
      doc_currency: p.doc_currency as string | null,
    }));
  },
  ["invoices-payments-near"],
  { revalidate: 60 },
);
