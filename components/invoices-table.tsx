"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKESFull, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface InvoiceRow {
  doc_num: number | null;
  card_code: string;
  card_name: string | null;
  doc_date: string;
  doc_total: number;
  doc_status: string | null;
}

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "all" },
] as const;

export function InvoicesTable({
  invoices,
  currentRange,
}: {
  invoices: InvoiceRow[];
  currentRange: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(inv.doc_num ?? "").includes(q) ||
      inv.card_code.toLowerCase().includes(q) ||
      (inv.card_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => router.push(`/invoices?range=${r.value}`)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                currentRange === r.value
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search by doc # or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-slate-500">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-600">Doc #</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Date</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Customer</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-600">
                Total (KES)
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-slate-400"
                >
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 500).map((inv, i) => (
                <TableRow
                  key={inv.doc_num ?? `${inv.card_code}-${i}`}
                  className="border-slate-100 hover:bg-slate-50"
                >
                  <TableCell className="font-mono text-sm text-slate-700">
                    {inv.doc_num ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {formatDate(inv.doc_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium text-slate-900">
                      {inv.card_name ?? inv.card_code}
                    </span>
                    {inv.card_name && (
                      <span className="ml-2 text-xs text-slate-400">
                        {inv.card_code}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {formatKESFull(inv.doc_total)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 text-xs",
                        inv.doc_status === "O"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {inv.doc_status === "O"
                        ? "Open"
                        : inv.doc_status === "C"
                          ? "Closed"
                          : (inv.doc_status ?? "—")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
