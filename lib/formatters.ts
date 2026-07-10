import { format as dateFnsFormat } from "date-fns";

export function formatKES(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}KES ${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}KES ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}KES ${(abs / 1_000).toFixed(0)}K`;
  return `${sign}KES ${abs.toFixed(0)}`;
}

export function formatKESFull(amount: number): string {
  return `KES ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return dateFnsFormat(new Date(dateStr + "T00:00:00"), "dd MMM yyyy");
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return dateFnsFormat(new Date(dateStr), "dd MMM yyyy, HH:mm");
  } catch {
    return dateStr;
  }
}

// Plain thousand-separated number, no currency prefix — matches the source
// management-accounts workbook's own number formatting.
export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

// Accounting-style: negatives in parentheses (paired with text-red-600 at the
// call site). Returns "—" for null/undefined (no entry that period).
export function formatAccountingNumber(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "—";
  const formatted = formatNumber(Math.abs(n), decimals);
  return n < 0 ? `(${formatted})` : formatted;
}
