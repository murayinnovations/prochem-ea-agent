"use client";

import { useState, useMemo } from "react";
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
import { formatKESFull } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface Customer {
  card_code: string;
  card_name: string | null;
  country: string | null;
  currency: string | null;
  balance: number | null;
  credit_line: number | null;
  valid: boolean | null;
}

const PAGE_SIZE = 50;

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        (c.card_name ?? "").toLowerCase().includes(q) ||
        c.card_code.toLowerCase().includes(q) ||
        (c.country ?? "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const visible = search.trim() ? filtered : filtered.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-slate-500">
          {search.trim()
            ? `${filtered.length} of ${customers.length} customers`
            : `Showing ${Math.min(PAGE_SIZE, customers.length)} of ${customers.length} customers`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-600">Code</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Country</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Currency</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-600">
                Balance
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-slate-400"
                >
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              visible.map((c) => (
                <TableRow
                  key={c.card_code}
                  className="border-slate-100 hover:bg-slate-50"
                >
                  <TableCell className="font-mono text-xs text-slate-500">
                    {c.card_code}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">
                    {c.card_name ?? <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {c.country ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {c.currency ?? "KES"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {c.balance != null ? formatKESFull(c.balance) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 text-xs",
                        c.valid !== false
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {c.valid !== false ? "Active" : "Inactive"}
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
