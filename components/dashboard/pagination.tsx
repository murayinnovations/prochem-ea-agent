"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100, 200];

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  className?: string;
}

export function Pagination({ page, pageSize, total, className }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function navigate(nextPage: number, nextPageSize?: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    if (nextPageSize !== undefined) params.set("pageSize", String(nextPageSize));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={cn("flex items-center justify-between gap-4 py-3 text-sm text-slate-600", className)}>
      <p className="shrink-0">
        {total === 0 ? "No results" : `${from}–${to} of ${total.toLocaleString()}`}
      </p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Rows
          <select
            value={pageSize}
            onChange={(e) => navigate(1, Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => navigate(page - 1)}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="min-w-[80px] text-center text-xs">
          Page {page} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => navigate(page + 1)}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
