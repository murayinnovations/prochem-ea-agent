/**
 * Idempotent persistence for a parsed management-accounts workbook.
 * Upsert key is `period_month` — re-uploading the same month replaces
 * that upload's child rows rather than duplicating them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ParsedWorkbook } from "./types";

type DB = SupabaseClient<Database>;

const CHUNK_SIZE = 500;

type ChildTable =
  | "pnl_lines"
  | "cashflow_lines"
  | "aged_debtors_snapshots"
  | "aged_creditors_snapshots"
  | "mgmt_stock_snapshots"
  | "loan_facilities"
  | "directors_account_entries";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function replaceRows(db: DB, table: ChildTable, uploadId: string, rows: object[]) {
  const { error: deleteError } = await db.from(table).delete().eq("upload_id", uploadId);
  if (deleteError) throw new Error(`Failed clearing existing ${table}: ${deleteError.message}`);

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = await db.from(table).insert(
      batch.map((r) => ({ ...r, upload_id: uploadId })),
    );
    if (error) throw new Error(`Failed inserting ${table}: ${error.message}`);
  }
}

const CORE_SHEET_TYPES = 7;

function computeStatus(parsed: ParsedWorkbook): "success" | "partial" | "failed" {
  if (parsed.parsedSheets.length === 0) return "failed";
  const coreFailures = Object.values(parsed.skippedSheets).filter(
    (reason) => !reason.startsWith("Unrecognized sheet name"),
  );
  if (coreFailures.length > 0 || parsed.parsedSheets.length < CORE_SHEET_TYPES) return "partial";
  return "success";
}

export interface UploadResult {
  uploadId: string;
  periodMonth: string;
  periodLabel: string | null;
  status: "success" | "partial" | "failed";
  parsedSheets: string[];
  skippedSheets: Record<string, string>;
  rowCounts: Record<string, number>;
}

export async function upsertManagementAccountsUpload(
  db: DB,
  params: {
    parsed: ParsedWorkbook;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedBy?: string;
  },
): Promise<UploadResult> {
  const { parsed, fileName, filePath, fileSize, uploadedBy } = params;

  if (!parsed.periodMonth) {
    throw new Error(
      "Could not determine the reporting period from the workbook (no dated P&L/Cash Flow columns and no month found in the filename).",
    );
  }

  const rowCounts: Record<string, number> = {
    pnl_lines: parsed.pnlLines.length,
    cashflow_lines: parsed.cashflowLines.length,
    aged_debtors_snapshots: parsed.agedDebtors.length,
    aged_creditors_snapshots: parsed.agedCreditors.length,
    mgmt_stock_snapshots: parsed.stockLevels.length,
    loan_facilities: parsed.loanFacilities.length,
    directors_account_entries: parsed.directorsAccount.length,
  };

  const status = computeStatus(parsed);

  const { data: existing } = await db
    .from("management_accounts_uploads")
    .select("id")
    .eq("period_month", parsed.periodMonth)
    .maybeSingle();

  let uploadId: string;

  const uploadRow = {
    period_month: parsed.periodMonth,
    period_label: parsed.periodLabel,
    file_name: fileName,
    file_path: filePath,
    file_size: fileSize,
    sheet_names: parsed.sheetNames,
    parsed_sheets: parsed.parsedSheets,
    skipped_sheets: parsed.skippedSheets,
    row_counts: rowCounts,
    status,
    uploaded_by: uploadedBy ?? null,
    uploaded_at: new Date().toISOString(),
    parsed_at: new Date().toISOString(),
  };

  if (existing) {
    uploadId = existing.id as string;
    const { error } = await db
      .from("management_accounts_uploads")
      .update(uploadRow)
      .eq("id", uploadId);
    if (error) throw new Error(`Failed updating upload record: ${error.message}`);
  } else {
    const { data, error } = await db
      .from("management_accounts_uploads")
      .insert(uploadRow)
      .select("id")
      .single();
    if (error) throw new Error(`Failed creating upload record: ${error.message}`);
    uploadId = data.id as string;
  }

  await Promise.all([
    replaceRows(db, "pnl_lines", uploadId, parsed.pnlLines),
    replaceRows(db, "cashflow_lines", uploadId, parsed.cashflowLines),
    replaceRows(db, "aged_debtors_snapshots", uploadId, parsed.agedDebtors),
    replaceRows(db, "aged_creditors_snapshots", uploadId, parsed.agedCreditors),
    replaceRows(db, "mgmt_stock_snapshots", uploadId, parsed.stockLevels),
    replaceRows(db, "loan_facilities", uploadId, parsed.loanFacilities),
    replaceRows(db, "directors_account_entries", uploadId, parsed.directorsAccount),
  ]);

  return {
    uploadId,
    periodMonth: parsed.periodMonth,
    periodLabel: parsed.periodLabel,
    status,
    parsedSheets: parsed.parsedSheets,
    skippedSheets: parsed.skippedSheets,
    rowCounts,
  };
}
