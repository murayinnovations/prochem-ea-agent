"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import type { BrandsFilter } from "@/lib/filters/schema";

interface Props {
  current: BrandsFilter;
  groups: string[];
}

export function BrandsFilters({ current, groups }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (updates: Partial<BrandsFilter>) => {
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
          placeholder="Search SKUs…"
          defaultValue={current.search}
          onChange={(e) => update({ search: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {groups.length > 0 && (
        <select
          value={current.group}
          onChange={(e) => update({ group: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">All item groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      )}

      <select
        value={`${current.sort}:${current.sortDir}`}
        onChange={(e) => {
          const [sort, sortDir] = e.target.value.split(":");
          update({ sort: sort as BrandsFilter["sort"], sortDir: sortDir as "asc" | "desc" });
        }}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="revenue30d:desc">Revenue 30d ↓</option>
        <option value="revenue30d:asc">Revenue 30d ↑</option>
        <option value="volume30d:desc">Volume 30d ↓</option>
        <option value="name:asc">Name A–Z</option>
      </select>
    </>
  );
}
