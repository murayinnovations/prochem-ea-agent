"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatAccountingNumber, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { StockLevelRow } from "@/lib/queries/management-accounts";

type SortKey = "item_no" | "description" | "cumulative_qty" | "cumulative_value";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "item_no", label: "Item No.", align: "left" },
  { key: "description", label: "Description", align: "left" },
  { key: "cumulative_qty", label: "Cumulative Qty", align: "right" },
  { key: "cumulative_value", label: "Cumulative Value", align: "right" },
];

export function StockLevelsTab({ rows }: { rows: StockLevelRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cumulative_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "item_no" || key === "description" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            (r.description ?? "").toLowerCase().includes(q) || r.item_no.toLowerCase().includes(q),
        )
      : rows;

    return [...base].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          qty: acc.qty + r.cumulative_qty,
          value: acc.value + r.cumulative_value,
        }),
        { qty: 0, value: 0 },
      ),
    [rows],
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Filter by description or item no…"
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
              {filtered.map((r) => (
                <tr key={r.item_no} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.item_no}</td>
                  <td className="px-4 py-2.5 text-slate-900">{r.description ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {formatNumber(r.cumulative_qty, 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900">
                    {formatAccountingNumber(r.cumulative_value)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-16 text-center text-sm text-slate-400">
                    No items match your filter.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={2} className="px-4 py-3">
                    Grand Total ({rows.length.toLocaleString()} SKUs)
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(totals.qty, 2)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.value)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
