"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Package } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { SkuRow } from "@/lib/queries/brands";
import { formatKES } from "@/lib/formatters";

const COLUMNS: ColumnDef<SkuRow>[] = [
  {
    key: "item_name",
    header: "SKU",
    sortKey: "name",
    cell: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.item_name ?? row.item_code}</p>
        <p className="text-xs text-slate-400">{row.item_code}</p>
      </div>
    ),
  },
  {
    key: "group",
    header: "Item Group",
    cell: (row) => (
      <span className="text-sm text-slate-600">{row.items_group_name ?? "—"}</span>
    ),
  },
  {
    key: "revenue30d",
    header: "Revenue 30d",
    align: "right",
    sortKey: "revenue30d",
    cell: (row) => (
      <span className="font-medium text-slate-900">{formatKES(row.revenue30d)}</span>
    ),
  },
  {
    key: "volume30d",
    header: "Volume 30d",
    align: "right",
    sortKey: "volume30d",
    cell: (row) => (
      <span className="text-slate-600">
        {row.volume30d > 0
          ? `${row.volume30d.toLocaleString()} ${row.inventory_uom ?? ""}`
          : "—"}
      </span>
    ),
  },
  {
    key: "avg_price",
    header: "Avg Price",
    align: "right",
    cell: (row) => (
      <span className="text-slate-500">
        {row.avg_price30d != null ? formatKES(row.avg_price30d) : "—"}
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
  rows: SkuRow[];
  sortKey: string;
  sortDir: "asc" | "desc";
}

export function BrandsTable({ rows, sortKey, sortDir }: Props) {
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
      getRowKey={(r) => r.item_code}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      onRowClick={(row) => router.push(`/brands/${encodeURIComponent(row.item_code)}`)}
      emptyState={
        <EmptyState
          icon={Package}
          heading="No SKUs found"
          body="Try adjusting your search or filters."
        />
      }
    />
  );
}
