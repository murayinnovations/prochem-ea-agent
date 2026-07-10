"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatAccountingNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AgedDebtorRow } from "@/lib/queries/management-accounts";

type SortKey =
  | "customer_name"
  | "bucket_0_30"
  | "bucket_31_60"
  | "bucket_61_90"
  | "bucket_91_120"
  | "bucket_121_plus"
  | "total_kes";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "customer_name", label: "Customer", align: "left" },
  { key: "bucket_0_30", label: "0–30", align: "right" },
  { key: "bucket_31_60", label: "31–60", align: "right" },
  { key: "bucket_61_90", label: "61–90", align: "right" },
  { key: "bucket_91_120", label: "91–120", align: "right" },
  { key: "bucket_121_plus", label: "121+", align: "right" },
  { key: "total_kes", label: "Total", align: "right" },
];

export function AgedDebtorsTab({ rows }: { rows: AgedDebtorRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_kes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "customer_name" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.customer_name.toLowerCase().includes(q) ||
            (r.customer_code ?? "").toLowerCase().includes(q),
        )
      : rows;

    return [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          bucket_0_30: acc.bucket_0_30 + r.bucket_0_30,
          bucket_31_60: acc.bucket_31_60 + r.bucket_31_60,
          bucket_61_90: acc.bucket_61_90 + r.bucket_61_90,
          bucket_91_120: acc.bucket_91_120 + r.bucket_91_120,
          bucket_121_plus: acc.bucket_121_plus + r.bucket_121_plus,
          total_kes: acc.total_kes + r.total_kes,
        }),
        { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_91_120: 0, bucket_121_plus: 0, total_kes: 0 },
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
            placeholder="Search customer name or code…"
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
                <tr key={`${r.customer_code ?? "x"}-${i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{r.customer_name}</p>
                    {r.customer_code && (
                      <span className="font-mono text-[10px] text-slate-400">{r.customer_code}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {formatAccountingNumber(r.bucket_0_30)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {formatAccountingNumber(r.bucket_31_60)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {formatAccountingNumber(r.bucket_61_90)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {formatAccountingNumber(r.bucket_91_120)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-mono",
                      r.bucket_121_plus > 0 ? "bg-red-50/70 font-medium text-red-700" : "text-slate-700",
                    )}
                  >
                    {formatAccountingNumber(r.bucket_121_plus)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                    {formatAccountingNumber(r.total_kes)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-16 text-center text-sm text-slate-400">
                    No customers match your search.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-4 py-3">Total ({rows.length.toLocaleString()} customers)</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.bucket_0_30)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.bucket_31_60)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.bucket_61_90)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.bucket_91_120)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.bucket_121_plus)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(totals.total_kes)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
