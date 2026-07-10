export interface PnlLineRow {
  row_order: number;
  account_name: string;
  month: string; // ISO date, first-of-month
  amount: number;
}

export interface CashflowLineRow {
  row_order: number;
  section: string | null;
  category_name: string;
  month: string;
  amount: number;
}

export interface AgedDebtorRow {
  row_order: number;
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
  row_order: number;
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
  row_order: number;
  item_no: string;
  description: string | null;
  cumulative_qty: number;
  cumulative_value: number;
}

export interface LoanFacilityRow {
  row_order: number;
  facility_name: string;
  amount: number;
}

export interface DirectorsAccountRow {
  row_order: number;
  posting_date: string | null;
  trans_no: number;
  origin: string | null;
  origin_no: number | null;
  offset_account: string | null;
  details: string | null;
  amount_lc: number | null;
}

export interface ParsedWorkbook {
  periodMonth: string | null; // ISO date, first-of-month
  periodLabel: string | null;
  sheetNames: string[];
  parsedSheets: string[];
  skippedSheets: Record<string, string>; // sheetName -> reason
  pnlLines: PnlLineRow[];
  cashflowLines: CashflowLineRow[];
  agedDebtors: AgedDebtorRow[];
  agedCreditors: AgedCreditorRow[];
  stockLevels: StockLevelRow[];
  loanFacilities: LoanFacilityRow[];
  directorsAccount: DirectorsAccountRow[];
}
