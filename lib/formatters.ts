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
