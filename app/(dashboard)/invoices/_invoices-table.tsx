"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { FileText } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { InvoiceListRow } from "@/lib/queries/invoices";
import { formatKES, formatDate } from "@/lib/formatters";

const COLUMNS: ColumnDef<InvoiceListRow>[] = [
  {
    key: "doc_num",
    header: "Invoice #",
    sortKey: "date",
    cell: (row) => (
      <span className="font-mono text-xs font-medium text-slate-900">
        {row.doc_num ?? row.doc_entry}
      </span>
    ),
    width: "100px",
  },
  {
    key: "doc_date",
    header: "Date",
    sortKey: "date",
    cell: (row) => <span className="text-slate-600">{formatDate(row.doc_date)}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customer",
    cell: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.card_name ?? row.card_code}</p>
        <p className="text-xs text-slate-400">{row.card_code}</p>
      </div>
    ),
  },
  {
    key: "doc_total",
    header: "Amount (KES)",
    align: "right",
    sortKey: "amount",
    cell: (row) => (
      <span className="font-medium text-slate-900">{formatKES(row.doc_total)}</span>
    ),
  },
  {
    key: "outstanding",
    header: "Outstanding",
    align: "right",
    cell: (row) => (
      <span className={row.outstanding > 0 ? "font-medium text-amber-700" : "text-slate-300"}>
        {row.outstanding > 0 ? formatKES(row.outstanding) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => {
      if (row.age_days != null && row.age_days > 0) return <StatusBadge variant="overdue" />;
      if (row.doc_status === "O") return <StatusBadge variant="open" />;
      return <StatusBadge variant="closed" />;
    },
  },
];

interface Props {
  rows: InvoiceListRow[];
  sortKey: string;
  sortDir: "asc" | "desc";
}

export function InvoicesTable({ rows, sortKey, sortDir }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleSort(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("sort") === key) {
      params.set("sortDir", params.get("sortDir") === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", key);
      params.set("sortDir", "desc");
    }
    params.set("page", "1");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowKey={(r) => r.doc_entry}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      onRowClick={(row) => router.push(`/invoices/${row.doc_entry}`)}
      emptyState={
        <EmptyState
          icon={FileText}
          heading="No invoices found"
          body="Try adjusting your date range or filters."
        />
      }
    />
  );
}
