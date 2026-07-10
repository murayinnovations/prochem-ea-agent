"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatAccountingNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AgedCreditorRow } from "@/lib/queries/management-accounts";

type SortKey = "vendor_name" | "posting_date" | "due_date" | "balance_due";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "vendor_name", label: "Vendor", align: "left" },
  { key: "posting_date", label: "Posting Date", align: "left" },
  { key: "due_date", label: "Due Date", align: "left" },
  { key: "balance_due", label: "Balance Due", align: "right" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

export function AgedCreditorsTab({ rows }: { rows: AgedCreditorRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("balance_due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "vendor_name" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.vendor_name.toLowerCase().includes(q) || (r.vendor_code ?? "").toLowerCase().includes(q),
        )
      : rows;

    return [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.balance_due, 0), [rows]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search vendor name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-72 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <span className="text-xs text-slate-400">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "cursor-pointer select-none px-4 py-3 hover:bg-slate-100",
                      c.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r, i) => (
                <tr key={`${r.vendor_code ?? "x"}-${r.doc_no ?? i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{r.vendor_name}</p>
                    <span className="font-mono text-[10px] text-slate-400">
                      {[r.vendor_code, r.doc_type, r.doc_no].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.posting_date)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.due_date)}</td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-mono font-medium",
                      r.balance_due < 0 ? "text-red-600" : "text-slate-900",
                    )}
                  >
                    {formatAccountingNumber(r.balance_due)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-16 text-center text-sm text-slate-400">
                    No vendors match your search.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={3} className="px-4 py-3">
                    Total ({rows.length.toLocaleString()} vendors)
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
