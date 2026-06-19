"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import type { InvoicesFilter } from "@/lib/filters/schema";

interface Props {
  current: InvoicesFilter;
}

export function InvoicesFilters({ current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (updates: Partial<InvoicesFilter>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, String(v));
      }
      params.set("page", "1");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    },
    [router, pathname, searchParams],
  );

  return (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search customer…"
          defaultValue={current.customerSearch}
          onChange={(e) => update({ customerSearch: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={current.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          value={current.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <select
        value={current.status}
        onChange={(e) => update({ status: e.target.value as InvoicesFilter["status"] })}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="all">All statuses</option>
        <option value="O">Open</option>
        <option value="C">Closed</option>
      </select>

      <select
        value={`${current.sort}:${current.sortDir}`}
        onChange={(e) => {
          const [sort, sortDir] = e.target.value.split(":");
          update({ sort: sort as InvoicesFilter["sort"], sortDir: sortDir as "asc" | "desc" });
        }}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="date:desc">Date ↓</option>
        <option value="date:asc">Date ↑</option>
        <option value="amount:desc">Amount ↓</option>
        <option value="amount:asc">Amount ↑</option>
        <option value="customer:asc">Customer A–Z</option>
      </select>
    </>
  );
}
