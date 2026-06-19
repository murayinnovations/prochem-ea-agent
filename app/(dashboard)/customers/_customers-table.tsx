"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Users } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { CustomerRow } from "@/lib/queries/customers";
import { formatKES, formatDate } from "@/lib/formatters";

const COLUMNS: ColumnDef<CustomerRow>[] = [
  {
    key: "card_name",
    header: "Customer",
    sortKey: "name",
    cell: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.card_name ?? row.card_code}</p>
        <p className="text-xs text-slate-400">{row.card_code}</p>
      </div>
    ),
  },
  {
    key: "country",
    header: "Country",
    cell: (row) => <span className="text-slate-600">{row.country ?? "—"}</span>,
  },
  {
    key: "revenue30d",
    header: "Rev 30d",
    align: "right",
    sortKey: "revenue30d",
    cell: (row) => (
      <span className="font-medium text-slate-900">{formatKES(row.revenue30d)}</span>
    ),
  },
  {
    key: "revenue12mo",
    header: "Rev 12mo",
    align: "right",
    cell: (row) => <span className="text-slate-600">{formatKES(row.revenue12mo)}</span>,
  },
  {
    key: "ar",
    header: "Outstanding AR",
    align: "right",
    sortKey: "ar",
    cell: (row) => (
      <span className={row.ar > 0 ? "font-medium text-amber-700" : "text-slate-400"}>
        {row.ar > 0 ? formatKES(row.ar) : "—"}
      </span>
    ),
  },
  {
    key: "last_order",
    header: "Last Order",
    align: "right",
    sortKey: "lastOrder",
    cell: (row) => (
      <span className="text-slate-500">
        {row.last_order_date ? formatDate(row.last_order_date) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge variant={row.valid ? "active" : "inactive"} />,
  },
];

interface Props {
  rows: CustomerRow[];
  sortKey: string;
  sortDir: "asc" | "desc";
}

export function CustomersTable({ rows, sortKey, sortDir }: Props) {
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
      params.set("sortDir", "asc");
    }
    params.set("page", "1");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowKey={(r) => r.card_code}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      onRowClick={(row) => router.push(`/customers/${encodeURIComponent(row.card_code)}`)}
      emptyState={
        <EmptyState
          icon={Users}
          heading="No customers found"
          body="Try adjusting your search or filters."
        />
      }
    />
  );
}
