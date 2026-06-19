"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
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

export interface PaymentRow {
  doc_entry: number;
  card_code: string;
  card_name: string | null;
  doc_date: string;
  doc_total: number;
  doc_currency: string | null;
  cancelled: boolean | null;
}

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "all" },
] as const;

export function PaymentsTable({
  payments,
  currentRange,
}: {
  payments: PaymentRow[];
  currentRange: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = payments.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(p.doc_entry).includes(q) ||
      p.card_code.toLowerCase().includes(q) ||
      (p.card_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => router.push(`/payments?range=${r.value}`)}
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
          placeholder="Search by entry # or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-slate-500">
          {filtered.length} payment{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-600">Entry #</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Date</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Customer</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-600">
                Total (KES)
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Currency</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-slate-400"
                >
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 500).map((p) => (
                <TableRow
                  key={p.doc_entry}
                  className="border-slate-100 hover:bg-slate-50"
                >
                  <TableCell className="font-mono text-sm text-slate-700">
                    {p.doc_entry}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {formatDate(p.doc_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium text-slate-900">
                      {p.card_name ?? p.card_code}
                    </span>
                    {p.card_name && (
                      <span className="ml-2 text-xs text-slate-400">
                        {p.card_code}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {formatKESFull(p.doc_total)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {p.doc_currency ?? "KES"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 text-xs",
                        p.cancelled
                          ? "bg-red-50 text-red-600"
                          : "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {p.cancelled ? "Cancelled" : "Posted"}
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
