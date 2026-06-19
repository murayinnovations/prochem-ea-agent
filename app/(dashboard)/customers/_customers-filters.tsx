"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import type { CustomersFilter } from "@/lib/filters/schema";

interface Props {
  current: CustomersFilter;
  countries: string[];
}

export function CustomersFilters({ current, countries }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (updates: Partial<CustomersFilter>) => {
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
          placeholder="Search customers…"
          defaultValue={current.search}
          onChange={(e) => update({ search: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {countries.length > 0 && (
        <select
          value={current.country}
          onChange={(e) => update({ country: e.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      <select
        value={`${current.sort}:${current.sortDir}`}
        onChange={(e) => {
          const [sort, sortDir] = e.target.value.split(":");
          update({ sort: sort as CustomersFilter["sort"], sortDir: sortDir as "asc" | "desc" });
        }}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="name:asc">Name A–Z</option>
        <option value="name:desc">Name Z–A</option>
        <option value="revenue30d:desc">Revenue 30d ↓</option>
        <option value="revenue30d:asc">Revenue 30d ↑</option>
        <option value="ar:desc">AR ↓</option>
        <option value="lastOrder:desc">Last Order ↓</option>
      </select>

      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={current.activeOnly}
          onChange={(e) => update({ activeOnly: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 accent-amber-500"
        />
        Active only
      </label>
    </>
  );
}
