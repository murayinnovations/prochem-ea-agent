/**
 * Excel serial date + text date helpers.
 *
 * xlsx's `cellDates: true` mode converts serials to JS Date using the
 * *local* timezone, which round-trips fine on a Nairobi (UTC+3) machine
 * but is fragile elsewhere (deploys run in UTC). We read raw numeric
 * serials instead and convert them ourselves — a pure calendar
 * calculation with no timezone involved.
 */

const EXCEL_EPOCH_DAYS_TO_UNIX = 25569; // days between 1899-12-30 and 1970-01-01

export function excelSerialToISODate(serial: number): string {
  const unixMs = Math.round((serial - EXCEL_EPOCH_DAYS_TO_UNIX) * 86400 * 1000);
  const d = new Date(unixMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Parses "DD.MM.YY" text dates used in Aged Creditors / Directors Account. Returns null if unparseable. */
export function parseDDMMYY(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  const day = Number(dd);
  const month = Number(mm);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}
