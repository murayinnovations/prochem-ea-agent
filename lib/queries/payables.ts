import { unstable_cache } from "next/cache";
import { format, subDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";

export interface ApInvoiceRow {
  doc_entry: number;
  doc_num: number | null;
  card_code: string;
  doc_date: string;
  doc_due_date: string | null;
  doc_total: number;
  paid_to_date: number;
  outstanding: number;
  doc_status: string | null;
}

export interface PurchaseOrderRow {
  doc_entry: number;
  doc_num: number | null;
  card_code: string;
  doc_date: string;
  doc_due_date: string | null;
  doc_total: number;
  doc_status: string | null;
}

export interface ApKpis {
  openApTotal: number;
  openApCount: number;
  openPoTotal: number;
  openPoCount: number;
  apInvoices30d: number;
}

// All KPI aggregations are direct paginated sums — never capped in-memory totals.
export const getApKpis = unstable_cache(
  async (): Promise<ApKpis> => {
    const supabase = createAdminClient();
    const d30 = format(subDays(new Date(), 30), "yyyy-MM-dd");

    let openApTotal = 0;
    let openApCount = 0;
    for (let page = 0; page < 200; page++) {
      const { data } = await supabase
        .from("ap_invoices")
        .select("doc_total, paid_to_date")
        .eq("doc_status", "O")
        .eq("cancelled", false)
        .range(page * 1000, (page + 1) * 1000 - 1);
      const rows = data ?? [];
      for (const r of rows) {
        openApTotal += Math.max(
          0,
          Number(r.doc_total ?? 0) - Number(r.paid_to_date ?? 0)
        );
        openApCount++;
      }
      if (rows.length < 1000) break;
    }

    let openPoTotal = 0;
    let openPoCount = 0;
    for (let page = 0; page < 200; page++) {
      const { data } = await supabase
        .from("purchase_orders")
        .select("doc_total")
        .eq("doc_status", "O")
        .eq("cancelled", false)
        .range(page * 1000, (page + 1) * 1000 - 1);
      const rows = data ?? [];
      for (const r of rows) {
        openPoTotal += Number(r.doc_total ?? 0);
        openPoCount++;
      }
      if (rows.length < 1000) break;
    }

    // AP invoices received in last 30 days (total value, regardless of payment status)
    let apInvoices30d = 0;
    for (let page = 0; page < 200; page++) {
      const { data } = await supabase
        .from("ap_invoices")
        .select("doc_total")
        .gte("doc_date", d30)
        .eq("cancelled", false)
        .range(page * 1000, (page + 1) * 1000 - 1);
      const rows = data ?? [];
      for (const r of rows) apInvoices30d += Number(r.doc_total ?? 0);
      if (rows.length < 1000) break;
    }

    return { openApTotal, openApCount, openPoTotal, openPoCount, apInvoices30d };
  },
  ["payables-kpis"],
  { revalidate: 120 },
);

export const listApInvoices = unstable_cache(
  async (
    input: { status?: "O" | "C"; page?: number; pageSize?: number } = {}
  ) => {
    const { status = "O", page = 1, pageSize = 50 } = input;
    const supabase = createAdminClient();
    const pageStart = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function af(q: any): any {
      q = q.eq("cancelled", false);
      if (status) q = q.eq("doc_status", status);
      return q;
    }

    // count: 'exact' on the filtered set
    const { count: exactCount } = await af(
      supabase.from("ap_invoices").select("*", { count: "exact", head: true })
    );
    const total = exactCount ?? 0;
    if (total === 0) return { rows: [] as ApInvoiceRow[], total: 0 };

    const { data, error } = await af(
      supabase.from("ap_invoices").select(
        "doc_entry, doc_num, card_code, doc_date, doc_due_date, doc_total, paid_to_date, doc_status"
      )
    )
      .order("doc_date", { ascending: false })
      .range(pageStart, pageStart + pageSize - 1);

    if (error) throw new Error(`listApInvoices: ${error.message}`);

    const rows: ApInvoiceRow[] = (data ?? []).map(
      (r: Record<string, unknown>) => ({
        doc_entry: r.doc_entry as number,
        doc_num: r.doc_num as number | null,
        card_code: r.card_code as string,
        doc_date: r.doc_date as string,
        doc_due_date: r.doc_due_date as string | null,
        doc_total: Number(r.doc_total ?? 0),
        paid_to_date: Number(r.paid_to_date ?? 0),
        outstanding: Math.max(
          0,
          Number(r.doc_total ?? 0) - Number(r.paid_to_date ?? 0)
        ),
        doc_status: r.doc_status as string | null,
      })
    );

    return { rows, total };
  },
  ["ap-invoices-list"],
  { revalidate: 60 },
);

export const listPurchaseOrders = unstable_cache(
  async (
    input: { status?: "O" | "C"; page?: number; pageSize?: number } = {}
  ) => {
    const { status = "O", page = 1, pageSize = 50 } = input;
    const supabase = createAdminClient();
    const pageStart = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function af(q: any): any {
      q = q.eq("cancelled", false);
      if (status) q = q.eq("doc_status", status);
      return q;
    }

    const { count: exactCount } = await af(
      supabase.from("purchase_orders").select("*", { count: "exact", head: true })
    );
    const total = exactCount ?? 0;
    if (total === 0) return { rows: [] as PurchaseOrderRow[], total: 0 };

    const { data, error } = await af(
      supabase.from("purchase_orders").select(
        "doc_entry, doc_num, card_code, doc_date, doc_due_date, doc_total, doc_status"
      )
    )
      .order("doc_date", { ascending: false })
      .range(pageStart, pageStart + pageSize - 1);

    if (error) throw new Error(`listPurchaseOrders: ${error.message}`);

    const rows: PurchaseOrderRow[] = (data ?? []).map(
      (r: Record<string, unknown>) => ({
        doc_entry: r.doc_entry as number,
        doc_num: r.doc_num as number | null,
        card_code: r.card_code as string,
        doc_date: r.doc_date as string,
        doc_due_date: r.doc_due_date as string | null,
        doc_total: Number(r.doc_total ?? 0),
        doc_status: r.doc_status as string | null,
      })
    );

    return { rows, total };
  },
  ["purchase-orders-list"],
  { revalidate: 60 },
);

export const getOpenPurchaseOrdersValue = unstable_cache(
  async (): Promise<number> => {
    const supabase = createAdminClient();
    let total = 0;
    for (let page = 0; page < 200; page++) {
      const { data } = await supabase
        .from("purchase_orders")
        .select("doc_total")
        .eq("doc_status", "O")
        .eq("cancelled", false)
        .range(page * 1000, (page + 1) * 1000 - 1);
      const rows = data ?? [];
      for (const r of rows) total += Number(r.doc_total ?? 0);
      if (rows.length < 1000) break;
    }
    return total;
  },
  ["purchase-orders-open-value"],
  { revalidate: 120 },
);
