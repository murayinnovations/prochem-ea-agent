"use client";

import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortKey?: string;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  // Role in the stacked card layout used below md. Defaults to a labelled
  // field; "title" leads the card (first column if none set), "badge" sits
  // top-right, "hidden" is dropped on small screens.
  mobile?: "title" | "badge" | "hidden";
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  emptyState,
  className,
}: DataTableProps<T>) {
  const alignClass = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  };

  const titleCol = columns.find((c) => c.mobile === "title") ?? columns[0];
  const badgeCol = columns.find((c) => c.mobile === "badge");
  const fieldCols = columns.filter((c) => c !== titleCol && c !== badgeCol && c.mobile !== "hidden");

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {/* Stacked cards on phones — wide tables are unreadable at 390px */}
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.length === 0
          ? (emptyState ?? (
              <div className="py-16 text-center text-sm text-slate-400">No results found</div>
            ))
          : rows.map((row, i) => (
              <div
                key={getRowKey(row)}
                className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-slate-50")}
                onClick={() => onRowClick?.(row)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm">{titleCol.cell(row, i)}</div>
                  {badgeCol && <div className="shrink-0">{badgeCol.cell(row, i)}</div>}
                </div>
                {fieldCols.length > 0 && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                    {fieldCols.map((col) => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {col.header}
                        </dt>
                        <dd className="mt-0.5 truncate text-sm text-slate-700">{col.cell(row, i)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-slate-200 px-4 py-3",
                    alignClass[col.align ?? "left"],
                    col.sortKey && onSort && "cursor-pointer select-none hover:bg-slate-100",
                    col.width,
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortKey && onSort?.(col.sortKey)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortKey && onSort && (
                      <span className="text-slate-400">
                        {sortKey === col.sortKey ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {emptyState ?? (
                    <div className="py-16 text-center text-sm text-slate-400">
                      No results found
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={getRowKey(row)}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-slate-50",
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-slate-700",
                        alignClass[col.align ?? "left"],
                      )}
                    >
                      {col.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
