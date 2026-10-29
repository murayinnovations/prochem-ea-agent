import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MANAGEMENT_ACCOUNTS_LIST_TAG = "management-accounts-uploads";
export const MANAGEMENT_ACCOUNTS_DETAIL_TAG = "management-accounts-upload-detail";
export const MANAGEMENT_ACCOUNTS_TRENDS_TAG = "management-accounts-trends";

export interface ManagementAccountsUploadSummary {
  id: string;
  period_month: string;
  period_label: string | null;
  file_name: string;
  status: string;
  uploaded_at: string;
  uploaded_by: string | null;
  revenue_kes: number | null;
  ar_outstanding_kes: number;
  stock_value_kes: number;
}

// Row limit is generous — even 5 years of monthly uploads is ~60 rows, and each
// side query below is filtered/scoped per upload, not a full-table scan.
export const listManagementAccountsUploads = unstable_cache(
  async (): Promise<ManagementAccountsUploadSummary[]> => {
    const db = createAdminClient();

    const { data: uploads, error } = await db
      .from("management_accounts_uploads")
      .select("id, period_month, period_label, file_name, status, uploaded_at, uploaded_by")
      .order("period_month", { ascending: false });
    if (error) throw new Error(`listManagementAccountsUploads: ${error.message}`);

    const rows = (uploads ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];

    const uploadIds = rows.map((r) => r.id as string);

    // Side tables hold many rows per upload, so totals across all uploads are paged.
    const [revenueRows, arRows, stockRows] = await Promise.all([
      fetchAllRows<Record<string, unknown>>("uploads revenue", (from, to) =>
        db
          .from("pnl_lines")
          .select("upload_id, month, amount")
          .ilike("account_name", "%gross turnover%")
          .in("upload_id", uploadIds)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllForUploads<Record<string, unknown>>(db, "aged_debtors_snapshots", "upload_id, total_kes", uploadIds),
      fetchAllForUploads<Record<string, unknown>>(db, "mgmt_stock_snapshots", "upload_id, cumulative_value", uploadIds),
    ]);

    // Revenue is the single month matching each upload's own period (not a sum
    // across the workbook's full Jan–Dec columns) — keyed by upload_id:month.
    const revenueByKey = new Map<string, number>();
    for (const r of revenueRows) {
      const key = `${r.upload_id}:${r.month}`;
      revenueByKey.set(key, (revenueByKey.get(key) ?? 0) + Number(r.amount ?? 0));
    }

    const arByUpload = new Map<string, number>();
    for (const r of arRows) {
      const id = r.upload_id as string;
      arByUpload.set(id, (arByUpload.get(id) ?? 0) + Number(r.total_kes ?? 0));
    }

    const stockByUpload = new Map<string, number>();
    for (const r of stockRows) {
      const id = r.upload_id as string;
      stockByUpload.set(id, (stockByUpload.get(id) ?? 0) + Number(r.cumulative_value ?? 0));
    }

    return rows.map((u) => {
      const id = u.id as string;
      const period_month = u.period_month as string;
      return {
        id,
        period_month,
        period_label: u.period_label as string | null,
        file_name: u.file_name as string,
        status: u.status as string,
        uploaded_at: u.uploaded_at as string,
        uploaded_by: u.uploaded_by as string | null,
        revenue_kes: revenueByKey.get(`${id}:${period_month}`) ?? null,
        ar_outstanding_kes: arByUpload.get(id) ?? 0,
        stock_value_kes: stockByUpload.get(id) ?? 0,
      };
    });
  },
  ["management-accounts-uploads-list"],
  { revalidate: 3600, tags: [MANAGEMENT_ACCOUNTS_LIST_TAG] },
);

// ── Per-upload detail (per-month viewer) ────────────────────────────────────

// pnl_lines (up to ~1300 rows/upload) and cashflow_lines (~600) exceed
// PostgREST's default 1000-row cap, so every child table is fetched in pages.
async function fetchAll<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  uploadId: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * 1000;
    const to = from + 999;
    const { data, error } = await db
      .from(table)
      .select(columns)
      .eq("upload_id", uploadId)
      .order("row_order", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export interface PivotRow {
  label: string;
  section: string | null;
  values: (number | null)[];
}

export interface PivotTableData {
  months: string[];
  rows: PivotRow[];
}

function buildPivot(
  entries: Array<{ row_order: number; label: string; section: string | null; month: string; amount: number }>,
): PivotTableData {
  const monthsSet = new Set<string>();
  const byRowOrder = new Map<number, { label: string; section: string | null; values: Map<string, number> }>();

  for (const e of entries) {
    monthsSet.add(e.month);
    let group = byRowOrder.get(e.row_order);
    if (!group) {
      group = { label: e.label, section: e.section, values: new Map() };
      byRowOrder.set(e.row_order, group);
    }
    group.values.set(e.month, e.amount);
  }

  const months = Array.from(monthsSet).sort();
  const rows = Array.from(byRowOrder.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, g]) => ({
      label: g.label,
      section: g.section,
      values: months.map((m) => g.values.get(m) ?? null),
    }));

  return { months, rows };
}

export interface AgedDebtorRow {
  customer_code: string | null;
  customer_name: string;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_91_120: number;
  bucket_121_plus: number;
  total_kes: number;
}

export interface AgedCreditorRow {
  vendor_code: string | null;
  vendor_name: string;
  doc_type: string | null;
  doc_no: string | null;
  posting_date: string | null;
  due_date: string | null;
  bp_ref_no: string | null;
  balance_due: number;
}

export interface StockLevelRow {
  item_no: string;
  description: string | null;
  cumulative_qty: number;
  cumulative_value: number;
}

export interface LoanFacilityRow {
  facility_name: string;
  amount: number;
}

export interface DirectorsAccountRow {
  posting_date: string | null;
  trans_no: number;
  origin: string | null;
  origin_no: number | null;
  offset_account: string | null;
  details: string | null;
  amount_lc: number | null;
}

export interface ManagementAccountsUploadDetail {
  id: string;
  period_month: string;
  period_label: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  status: string;
  parsed_sheets: string[];
  skipped_sheets: Record<string, string>;
  uploaded_at: string;
  pnl: PivotTableData;
  cashflow: PivotTableData;
  agedDebtors: AgedDebtorRow[];
  agedCreditors: AgedCreditorRow[];
  stockLevels: StockLevelRow[];
  loanFacilities: LoanFacilityRow[];
  directorsAccount: DirectorsAccountRow[];
}

export const getManagementAccountsUploadDetail = unstable_cache(
  async (uploadId: string): Promise<ManagementAccountsUploadDetail | null> => {
    const db = createAdminClient();

    const { data: upload, error } = await db
      .from("management_accounts_uploads")
      .select(
        "id, period_month, period_label, file_name, file_path, file_size, status, parsed_sheets, skipped_sheets, uploaded_at",
      )
      .eq("id", uploadId)
      .maybeSingle();
    if (error) throw new Error(`getManagementAccountsUploadDetail: ${error.message}`);
    if (!upload) return null;

    const [pnlRows, cashflowRows, agedDebtors, agedCreditors, stockLevels, loanFacilities, directorsAccount] =
      await Promise.all([
        fetchAll<Record<string, unknown>>(db, "pnl_lines", "row_order, account_name, month, amount", uploadId),
        fetchAll<Record<string, unknown>>(
          db,
          "cashflow_lines",
          "row_order, section, category_name, month, amount",
          uploadId,
        ),
        fetchAll<Record<string, unknown>>(db, "aged_debtors_snapshots", "*", uploadId),
        fetchAll<Record<string, unknown>>(db, "aged_creditors_snapshots", "*", uploadId),
        fetchAll<Record<string, unknown>>(db, "mgmt_stock_snapshots", "*", uploadId),
        fetchAll<Record<string, unknown>>(db, "loan_facilities", "*", uploadId),
        fetchAll<Record<string, unknown>>(db, "directors_account_entries", "*", uploadId),
      ]);

    const pnl = buildPivot(
      pnlRows.map((r) => ({
        row_order: r.row_order as number,
        label: r.account_name as string,
        section: null,
        month: r.month as string,
        amount: Number(r.amount ?? 0),
      })),
    );

    const cashflow = buildPivot(
      cashflowRows.map((r) => ({
        row_order: r.row_order as number,
        label: r.category_name as string,
        section: (r.section as string | null) ?? null,
        month: r.month as string,
        amount: Number(r.amount ?? 0),
      })),
    );

    return {
      id: upload.id as string,
      period_month: upload.period_month as string,
      period_label: upload.period_label as string | null,
      file_name: upload.file_name as string,
      file_path: upload.file_path as string,
      file_size: upload.file_size as number | null,
      status: upload.status as string,
      parsed_sheets: (upload.parsed_sheets as string[]) ?? [],
      skipped_sheets: (upload.skipped_sheets as Record<string, string>) ?? {},
      uploaded_at: upload.uploaded_at as string,
      pnl,
      cashflow,
      agedDebtors: agedDebtors.map((r) => ({
        customer_code: r.customer_code as string | null,
        customer_name: r.customer_name as string,
        bucket_0_30: Number(r.bucket_0_30 ?? 0),
        bucket_31_60: Number(r.bucket_31_60 ?? 0),
        bucket_61_90: Number(r.bucket_61_90 ?? 0),
        bucket_91_120: Number(r.bucket_91_120 ?? 0),
        bucket_121_plus: Number(r.bucket_121_plus ?? 0),
        total_kes: Number(r.total_kes ?? 0),
      })),
      agedCreditors: agedCreditors.map((r) => ({
        vendor_code: r.vendor_code as string | null,
        vendor_name: r.vendor_name as string,
        doc_type: r.doc_type as string | null,
        doc_no: r.doc_no as string | null,
        posting_date: r.posting_date as string | null,
        due_date: r.due_date as string | null,
        bp_ref_no: r.bp_ref_no as string | null,
        balance_due: Number(r.balance_due ?? 0),
      })),
      stockLevels: stockLevels.map((r) => ({
        item_no: r.item_no as string,
        description: r.description as string | null,
        cumulative_qty: Number(r.cumulative_qty ?? 0),
        cumulative_value: Number(r.cumulative_value ?? 0),
      })),
      loanFacilities: loanFacilities.map((r) => ({
        facility_name: r.facility_name as string,
        amount: Number(r.amount ?? 0),
      })),
      directorsAccount: directorsAccount.map((r) => ({
        posting_date: r.posting_date as string | null,
        trans_no: Number(r.trans_no),
        origin: r.origin as string | null,
        origin_no: r.origin_no != null ? Number(r.origin_no) : null,
        offset_account: r.offset_account as string | null,
        details: r.details as string | null,
        amount_lc: r.amount_lc != null ? Number(r.amount_lc) : null,
      })),
    };
  },
  ["management-accounts-upload-detail"],
  { revalidate: 3600, tags: [MANAGEMENT_ACCOUNTS_DETAIL_TAG] },
);

// ── Trends across all uploads ────────────────────────────────────────────────

export interface TrendPoint {
  month: string; // = the owning upload's period_month
  value: number;
}

export interface ManagementAccountsTrendsData {
  monthsAvailable: number;
  pnl: Record<string, TrendPoint[]>;
  customers: Record<string, TrendPoint[]>;
  stock: Record<string, TrendPoint[]>;
}

async function fetchAllForUploads<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  uploadIds: string[],
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 100; page++) {
    const from = page * 1000;
    const { data, error } = await db.from(table).select(columns).in("upload_id", uploadIds).order("id", { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`fetchAllForUploads(${table}): ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export const getManagementAccountsTrends = unstable_cache(
  async (): Promise<ManagementAccountsTrendsData> => {
    const db = createAdminClient();
    const { data: uploads } = await db
      .from("management_accounts_uploads")
      .select("id, period_month")
      .order("period_month", { ascending: true });
    const uploadRows = (uploads ?? []) as Array<{ id: string; period_month: string }>;
    if (uploadRows.length === 0) return { monthsAvailable: 0, pnl: {}, customers: {}, stock: {} };

    const periodByUpload = new Map(uploadRows.map((u) => [u.id, u.period_month]));
    const uploadIds = uploadRows.map((u) => u.id);

    const [pnlRows, custRows, stockRows] = await Promise.all([
      fetchAllForUploads<Record<string, unknown>>(db, "pnl_lines", "upload_id, account_name, month, amount", uploadIds),
      fetchAllForUploads<Record<string, unknown>>(db, "aged_debtors_snapshots", "upload_id, customer_name, total_kes", uploadIds),
      fetchAllForUploads<Record<string, unknown>>(db, "mgmt_stock_snapshots", "upload_id, description, cumulative_value", uploadIds),
    ]);

    const pnl: Record<string, TrendPoint[]> = {};
    for (const r of pnlRows) {
      const period = periodByUpload.get(r.upload_id as string);
      if (!period || r.month !== period) continue; // only the point matching that upload's own reporting month
      const key = r.account_name as string;
      (pnl[key] ??= []).push({ month: period, value: Number(r.amount ?? 0) });
    }

    const customers: Record<string, TrendPoint[]> = {};
    for (const r of custRows) {
      const period = periodByUpload.get(r.upload_id as string);
      if (!period) continue;
      const key = r.customer_name as string;
      (customers[key] ??= []).push({ month: period, value: Number(r.total_kes ?? 0) });
    }

    const stock: Record<string, TrendPoint[]> = {};
    for (const r of stockRows) {
      const period = periodByUpload.get(r.upload_id as string);
      if (!period || !r.description) continue;
      const key = r.description as string;
      (stock[key] ??= []).push({ month: period, value: Number(r.cumulative_value ?? 0) });
    }

    for (const series of [pnl, customers, stock]) {
      for (const key in series) series[key].sort((a, b) => a.month.localeCompare(b.month));
    }

    return { monthsAvailable: uploadRows.length, pnl, customers, stock };
  },
  ["management-accounts-trends"],
  { revalidate: 3600, tags: [MANAGEMENT_ACCOUNTS_TRENDS_TAG] },
);
