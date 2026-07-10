"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { formatAccountingNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { DirectorsAccountRow } from "@/lib/queries/management-accounts";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

// Plain helper (not the component body) so the running `balance` mutation
// isn't flagged as a render-immutability violation.
function withRunningBalance(rows: DirectorsAccountRow[]): Array<DirectorsAccountRow & { balance: number }> {
  let balance = 0;
  return rows.map((r) => {
    balance += r.amount_lc ?? 0;
    return { ...r, balance };
  });
}

export function DirectorsAccountTab({ rows }: { rows: DirectorsAccountRow[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Running balance is computed over the full, row_order-sorted ledger — the
  // date filter only changes which rows are shown, not the balance itself
  // (like a bank statement filtered to a date range).
  const withBalance = useMemo(() => withRunningBalance(rows), [rows]);

  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return withBalance;
    return withBalance.filter((r) => {
      if (!r.posting_date) return false;
      if (dateFrom && r.posting_date < dateFrom) return false;
      if (dateTo && r.posting_date > dateTo) return false;
      return true;
    });
  }, [withBalance, dateFrom, dateTo]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="text-xs font-medium text-amber-700 hover:text-amber-800"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-slate-400">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Posting Date</th>
                <th className="px-4 py-3 text-left">Trans. No.</th>
                <th className="px-4 py-3 text-left">Origin</th>
                <th className="px-4 py-3 text-left">Origin No.</th>
                <th className="px-4 py-3 text-left">Offset Account</th>
                <th className="px-4 py-3 text-left">Details</th>
                <th className="px-4 py-3 text-right">C/D (LC)</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r, i) => (
                <tr key={`${r.trans_no}-${i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.posting_date)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.trans_no}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.origin ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.origin_no ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.offset_account ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.details ?? "—"}</td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-mono",
                      (r.amount_lc ?? 0) < 0 && "text-red-600",
                    )}
                  >
                    {formatAccountingNumber(r.amount_lc)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900">
                    {formatAccountingNumber(r.balance)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                    No entries in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
