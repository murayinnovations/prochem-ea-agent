import { Suspense } from "react";
import Link from "next/link";
import { Info, Package, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Pagination } from "@/components/dashboard/pagination";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BrandsFilters } from "./_brands-filters";
import { BrandsTable } from "./_brands-table";
import { listSkus, getItemGroups, getFastMovingSkus } from "@/lib/queries/brands";
import { brandsFilterSchema } from "@/lib/filters/schema";
import { parseSearchParams } from "@/lib/filters/parse";
import { formatKES } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  searchParams: Promise<Record<string, string | string[]>>;
}

// ── Fast-Moving SKUs section ──────────────────────────────────────────────────

async function FastMovingSkusSection() {
  const skus = await getFastMovingSkus({ days: 30, limit: 15 });

  if (skus.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Fast-Moving SKUs (30d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-slate-400">
            No sales data in the last 30 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700">
          Fast-Moving SKUs — last 30 days
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-600">Item</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Group</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-600">
                Volume (30d)
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Trend vs prior 30d</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-600">
                Product Revenue (30d)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skus.map((sku) => {
              const trendUp = sku.trend_pct !== null && sku.trend_pct > 5;
              const trendDown = sku.trend_pct !== null && sku.trend_pct < -5;

              return (
                <TableRow key={sku.item_code} className="border-slate-100 hover:bg-slate-50">
                  <TableCell className="max-w-[200px]">
                    <Link
                      href={`/brands/${encodeURIComponent(sku.item_code)}`}
                      className="font-medium text-slate-900 hover:text-amber-700 truncate block"
                    >
                      {sku.item_name ?? sku.item_code}
                    </Link>
                    <span className="font-mono text-[10px] text-slate-400">{sku.item_code}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {sku.items_group_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {sku.total_volume.toLocaleString()}
                    {sku.inventory_uom && (
                      <span className="ml-1 text-[10px] text-slate-400">{sku.inventory_uom}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sku.trend_pct === null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        <Minus className="h-3 w-3" /> new
                      </span>
                    ) : trendUp ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <TrendingUp className="h-3 w-3" />
                        +{sku.trend_pct.toFixed(1)}%
                      </span>
                    ) : trendDown ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        <TrendingDown className="h-3 w-3" />
                        {sku.trend_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-slate-600",
                        "bg-slate-100"
                      )}>
                        <Minus className="h-3 w-3" />
                        {sku.trend_pct > 0 ? "+" : ""}{sku.trend_pct.toFixed(1)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-900">
                    {formatKES(sku.total_revenue)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BrandsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = parseSearchParams(brandsFilterSchema, params);

  const [{ rows, total }, groups] = await Promise.all([
    listSkus(filters),
    getItemGroups(),
  ]);

  const totalRev30 = rows.reduce((s, r) => s + r.revenue30d, 0);
  const totalVol30 = rows.reduce((s, r) => s + r.volume30d, 0);

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle={`${total.toLocaleString()} SKU${total !== 1 ? "s" : ""}`}
      />

      {/* UDF missing banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>
          Brand-level breakdown is not yet available — Prochem&apos;s SAP brand and category UDFs
          aren&apos;t populated. Showing performance by SAP item group and SKU. Brand grouping will
          activate automatically once those UDFs are configured.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <KpiStat label="SKUs shown" value={total.toLocaleString()} icon={Package} />
        <KpiStat label="Revenue (30d)" value={formatKES(totalRev30)} />
        <KpiStat label="Volume (30d)" value={totalVol30.toLocaleString()} />
      </div>

      {/* Fast-moving SKUs — above the filterable table */}
      <div className="mb-6">
        <Suspense fallback={
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Fast-Moving SKUs (30d)</CardTitle></CardHeader>
            <CardContent><div className="h-48 animate-pulse rounded-lg bg-slate-100" /></CardContent>
          </Card>
        }>
          <FastMovingSkusSection />
        </Suspense>
      </div>

      <FilterBar>
        <Suspense>
          <BrandsFilters current={filters} groups={groups} />
        </Suspense>
      </FilterBar>

      <Suspense>
        <BrandsTable rows={rows} sortKey={filters.sort} sortDir={filters.sortDir} />
      </Suspense>

      <Suspense>
        <Pagination
          page={filters.page}
          pageSize={filters.pageSize}
          total={total}
          className="mt-4"
        />
      </Suspense>
    </div>
  );
}
