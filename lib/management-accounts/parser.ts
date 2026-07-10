/**
 * Deterministic parser for the finance team's monthly management-accounts
 * workbook (7 sheets: P&L, Cash Flow, Aged Debtors, Aged Creditors,
 * Stock Levels, Loan Facilities, Directors Account).
 *
 * Each per-sheet parser looks for its known header row/labels and bails
 * out (returns null) if the shape doesn't match — this lets a workbook
 * that only has some of the 7 sheets (or a differently-shaped P&L, like
 * the 2-sheet summary variant) parse whatever it can instead of failing
 * the whole upload.
 */

import * as XLSX from "xlsx";
import { excelSerialToISODate, firstOfMonth, parseDDMMYY, isBlank, toNumberOrNull } from "./excel";
import type {
  ParsedWorkbook,
  PnlLineRow,
  CashflowLineRow,
  AgedDebtorRow,
  AgedCreditorRow,
  StockLevelRow,
  LoanFacilityRow,
  DirectorsAccountRow,
} from "./types";

type Row = unknown[];

const TOTAL_MARKERS = new Set(["TOTAL", "TOTALS", "GRAND TOTAL", "GRANDTOTALS", "GRANDTOTAL"]);

function isTotalLabel(value: unknown): boolean {
  return typeof value === "string" && TOTAL_MARKERS.has(value.trim().toUpperCase());
}

function sheetToRows(ws: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Row[];
}

function findSheet(wb: XLSX.WorkBook, aliases: string[]): string | null {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const targets = aliases.map(norm);
  for (const name of wb.SheetNames) {
    if (targets.includes(norm(name))) return name;
  }
  return null;
}

// ── Profit & Loss / Cash Flow (shared shape: NAME row + up to 12 monthly date columns) ──

interface MonthlyLedgerRow {
  row_order: number;
  section: string | null;
  name: string;
  month: string;
  amount: number;
}

function parseMonthlyLedgerSheet(ws: XLSX.WorkSheet): MonthlyLedgerRow[] | null {
  const rows = sheetToRows(ws);

  // Find the header row: column 0 is a label, columns 1..N are Excel date serials.
  let headerRowIdx = -1;
  let monthCols: number[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || isBlank(row[0])) continue;
    const cols: number[] = [];
    for (let c = 1; c < row.length; c++) {
      const v = row[c];
      // Excel date serials for 2015-2035 fall roughly in 42000-51500.
      if (typeof v === "number" && v > 25000 && v < 80000) cols.push(c);
      else if (cols.length > 0) break; // stop at first gap after we started collecting
    }
    if (cols.length >= 2) {
      headerRowIdx = i;
      monthCols = cols;
      break;
    }
  }
  if (headerRowIdx === -1) return null;

  const months = monthCols.map((c) => firstOfMonth(excelSerialToISODate(rows[headerRowIdx][c] as number)));

  const out: MonthlyLedgerRow[] = [];
  let currentSection: string | null = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isBlank(row[0])) continue;
    const name = String(row[0]).trim();

    const values = monthCols.map((c) => toNumberOrNull(row[c]));
    const allNull = values.every((v) => v === null);

    if (allNull) {
      // Section marker row (e.g. "CASH INFLOWS") — has a label but no data.
      currentSection = name;
      continue;
    }

    for (let mi = 0; mi < months.length; mi++) {
      const amount = values[mi];
      if (amount === null) continue; // no entry that month — skip rather than coerce to 0
      out.push({ row_order: i, section: currentSection, name, month: months[mi], amount });
    }
  }

  return out;
}

function parsePnl(ws: XLSX.WorkSheet): PnlLineRow[] | null {
  const rows = parseMonthlyLedgerSheet(ws);
  if (!rows) return null;
  return rows.map((r) => ({
    row_order: r.row_order,
    account_name: r.name,
    month: r.month,
    amount: r.amount,
  }));
}

function parseCashflow(ws: XLSX.WorkSheet): CashflowLineRow[] | null {
  const rows = parseMonthlyLedgerSheet(ws);
  if (!rows) return null;
  return rows.map((r) => ({
    row_order: r.row_order,
    section: r.section,
    category_name: r.name,
    month: r.month,
    amount: r.amount,
  }));
}

// ── Aged Debtors ──

function parseAgedDebtors(ws: XLSX.WorkSheet): AgedDebtorRow[] | null {
  const rows = sheetToRows(ws);
  const headerIdx = rows.findIndex(
    (r) => typeof r[0] === "string" && r[0].trim().toLowerCase() === "customer code",
  );
  if (headerIdx === -1) return null;

  const out: AgedDebtorRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isBlank(row[0])) continue; // blanks + TOTALS/GRANDTOTALS rows have no customer code

    const bucket_0_30 = toNumberOrNull(row[2]) ?? 0;
    const bucket_31_60 = toNumberOrNull(row[3]) ?? 0;
    const bucket_61_90 = toNumberOrNull(row[4]) ?? 0;
    const bucket_91_120 = toNumberOrNull(row[5]) ?? 0;
    const bucket_121_plus = toNumberOrNull(row[6]) ?? 0;

    out.push({
      row_order: i,
      customer_code: String(row[0]).trim(),
      customer_name: String(row[1] ?? "").trim(),
      bucket_0_30,
      bucket_31_60,
      bucket_61_90,
      bucket_91_120,
      bucket_121_plus,
      total_kes: bucket_0_30 + bucket_31_60 + bucket_61_90 + bucket_91_120 + bucket_121_plus,
    });
  }
  return out;
}

// ── Aged Creditors ──

function parseAgedCreditors(ws: XLSX.WorkSheet): AgedCreditorRow[] | null {
  const rows = sheetToRows(ws);
  let headerIdx = -1;
  let vendorCodeCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const idx = (rows[i] ?? []).findIndex(
      (c) => typeof c === "string" && c.trim().toLowerCase() === "vendor code",
    );
    if (idx !== -1) {
      headerIdx = i;
      vendorCodeCol = idx;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const nameCol = vendorCodeCol + 1;
  const typeCol = vendorCodeCol + 2;
  const docNoCol = vendorCodeCol + 3;
  const postingDateCol = vendorCodeCol + 4;
  const dueDateCol = vendorCodeCol + 5;
  const bpRefCol = vendorCodeCol + 6;
  const balanceCol = vendorCodeCol + 7;

  const out: AgedCreditorRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isBlank(row[vendorCodeCol])) continue; // blanks + TOTALS row have no vendor code

    out.push({
      row_order: i,
      vendor_code: String(row[vendorCodeCol]).trim(),
      vendor_name: String(row[nameCol] ?? "").trim(),
      doc_type: isBlank(row[typeCol]) ? null : String(row[typeCol]).trim(),
      doc_no: isBlank(row[docNoCol]) ? null : String(row[docNoCol]).trim(),
      posting_date: parseDDMMYY(row[postingDateCol]),
      due_date: parseDDMMYY(row[dueDateCol]),
      bp_ref_no: isBlank(row[bpRefCol]) ? null : String(row[bpRefCol]).trim(),
      balance_due: toNumberOrNull(row[balanceCol]) ?? 0,
    });
  }
  return out;
}

// ── Stock Levels ──

function parseStockLevels(ws: XLSX.WorkSheet): StockLevelRow[] | null {
  const rows = sheetToRows(ws);
  const headerIdx = rows.findIndex(
    (r) => typeof r[0] === "string" && r[0].trim().toLowerCase() === "item no.",
  );
  if (headerIdx === -1) return null;

  const out: StockLevelRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isBlank(row[0])) continue; // blanks + TOTALS row have no item no.

    out.push({
      row_order: i,
      item_no: String(row[0]).trim(),
      description: isBlank(row[1]) ? null : String(row[1]).trim(),
      cumulative_qty: toNumberOrNull(row[2]) ?? 0,
      cumulative_value: toNumberOrNull(row[3]) ?? 0,
    });
  }
  return out;
}

// ── Loan Facilities ──

function parseLoanFacilities(ws: XLSX.WorkSheet): LoanFacilityRow[] | null {
  const rows = sheetToRows(ws);
  const headerIdx = rows.findIndex(
    (r) => typeof r[0] === "string" && r[0].trim().toUpperCase() === "FACILITY",
  );
  if (headerIdx === -1) return null;

  const out: LoanFacilityRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isBlank(row[0]) || isTotalLabel(row[0])) continue;

    out.push({
      row_order: i,
      facility_name: String(row[0]).trim(),
      amount: toNumberOrNull(row[1]) ?? 0,
    });
  }
  return out;
}

// ── Directors Account ──

function parseDirectorsAccount(ws: XLSX.WorkSheet): DirectorsAccountRow[] | null {
  const rows = sheetToRows(ws);
  const headerIdx = rows.findIndex(
    (r) => typeof r[0] === "string" && r[0].trim().toLowerCase() === "posting date",
  );
  if (headerIdx === -1) return null;

  const out: DirectorsAccountRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const transNo = toNumberOrNull(row[1]);
    if (transNo === null) continue; // filters out the "OB" opening-balance row and the TOTALS row

    out.push({
      row_order: i,
      posting_date: parseDDMMYY(row[0]),
      trans_no: transNo,
      origin: isBlank(row[2]) ? null : String(row[2]).trim(),
      origin_no: toNumberOrNull(row[3]),
      offset_account: isBlank(row[4]) ? null : String(row[4]).trim(),
      details: isBlank(row[5]) ? null : String(row[5]).trim(),
      amount_lc: toNumberOrNull(row[6]),
    });
  }
  return out;
}

// ── Period detection ──

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function periodFromFileName(fileName: string): string | null {
  const m = fileName.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\D{0,4}(\d{4})\b/i,
  );
  if (!m) return null;
  const month = MONTH_NAMES[m[1].toLowerCase()];
  const year = Number(m[2]);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function labelFromPeriod(periodMonth: string): string {
  const [y, m] = periodMonth.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} ${y}`;
}

// ── Entry point ──

const SHEET_ALIASES = {
  pnl: ["Profit & Loss", "Profit and Loss", "P&L"],
  cashflow: ["Cash Flow", "Cashflow"],
  agedDebtors: ["Aged Debtors", "Aged Debtor"],
  agedCreditors: ["Aged Creditors", "Aged Creditor"],
  stock: ["Stock Levels", "Stock Level"],
  loans: ["Loan Facilities", "Loan Facility"],
  directors: ["Directors Account", "Director's Account", "Directors' Account"],
} as const;

export function parseManagementAccountsWorkbook(
  buffer: Buffer,
  fileName: string,
): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const result: ParsedWorkbook = {
    periodMonth: null,
    periodLabel: null,
    sheetNames: wb.SheetNames,
    parsedSheets: [],
    skippedSheets: {},
    pnlLines: [],
    cashflowLines: [],
    agedDebtors: [],
    agedCreditors: [],
    stockLevels: [],
    loanFacilities: [],
    directorsAccount: [],
  };

  const recognizedSheets = new Set<string>();

  const pnlSheet = findSheet(wb, [...SHEET_ALIASES.pnl]);
  if (pnlSheet) {
    recognizedSheets.add(pnlSheet);
    const parsed = parsePnl(wb.Sheets[pnlSheet]);
    if (parsed) {
      result.pnlLines = parsed;
      result.parsedSheets.push(pnlSheet);
    } else {
      result.skippedSheets[pnlSheet] =
        "Sheet shape doesn't match the expected NAME + 12 monthly-date-column layout.";
    }
  }

  const cashflowSheet = findSheet(wb, [...SHEET_ALIASES.cashflow]);
  if (cashflowSheet) {
    recognizedSheets.add(cashflowSheet);
    const parsed = parseCashflow(wb.Sheets[cashflowSheet]);
    if (parsed) {
      result.cashflowLines = parsed;
      result.parsedSheets.push(cashflowSheet);
    } else {
      result.skippedSheets[cashflowSheet] =
        "Sheet shape doesn't match the expected category + 12 monthly-date-column layout.";
    }
  }

  const debtorsSheet = findSheet(wb, [...SHEET_ALIASES.agedDebtors]);
  if (debtorsSheet) {
    recognizedSheets.add(debtorsSheet);
    const parsed = parseAgedDebtors(wb.Sheets[debtorsSheet]);
    if (parsed) {
      result.agedDebtors = parsed;
      result.parsedSheets.push(debtorsSheet);
    } else {
      result.skippedSheets[debtorsSheet] = "Could not find the 'Customer Code' header row.";
    }
  }

  const creditorsSheet = findSheet(wb, [...SHEET_ALIASES.agedCreditors]);
  if (creditorsSheet) {
    recognizedSheets.add(creditorsSheet);
    const parsed = parseAgedCreditors(wb.Sheets[creditorsSheet]);
    if (parsed) {
      result.agedCreditors = parsed;
      result.parsedSheets.push(creditorsSheet);
    } else {
      result.skippedSheets[creditorsSheet] = "Could not find the 'Vendor Code' header row.";
    }
  }

  const stockSheet = findSheet(wb, [...SHEET_ALIASES.stock]);
  if (stockSheet) {
    recognizedSheets.add(stockSheet);
    const parsed = parseStockLevels(wb.Sheets[stockSheet]);
    if (parsed) {
      result.stockLevels = parsed;
      result.parsedSheets.push(stockSheet);
    } else {
      result.skippedSheets[stockSheet] = "Could not find the 'Item No.' header row.";
    }
  }

  const loansSheet = findSheet(wb, [...SHEET_ALIASES.loans]);
  if (loansSheet) {
    recognizedSheets.add(loansSheet);
    const parsed = parseLoanFacilities(wb.Sheets[loansSheet]);
    if (parsed) {
      result.loanFacilities = parsed;
      result.parsedSheets.push(loansSheet);
    } else {
      result.skippedSheets[loansSheet] = "Could not find the 'FACILITY' header row.";
    }
  }

  const directorsSheet = findSheet(wb, [...SHEET_ALIASES.directors]);
  if (directorsSheet) {
    recognizedSheets.add(directorsSheet);
    const parsed = parseDirectorsAccount(wb.Sheets[directorsSheet]);
    if (parsed) {
      result.directorsAccount = parsed;
      result.parsedSheets.push(directorsSheet);
    } else {
      result.skippedSheets[directorsSheet] = "Could not find the 'Posting Date' header row.";
    }
  }

  for (const name of wb.SheetNames) {
    if (!recognizedSheets.has(name)) {
      result.skippedSheets[name] =
        "Unrecognized sheet name — not part of the management accounts template.";
    }
  }

  // Period detection: prefer the max month seen in P&L/Cash Flow, fall back to filename.
  const allMonths = [...result.pnlLines, ...result.cashflowLines].map((r) => r.month);
  if (allMonths.length > 0) {
    result.periodMonth = allMonths.sort().at(-1)!;
  } else {
    result.periodMonth = periodFromFileName(fileName);
  }
  if (result.periodMonth) {
    result.periodLabel = labelFromPeriod(result.periodMonth);
  }

  return result;
}
