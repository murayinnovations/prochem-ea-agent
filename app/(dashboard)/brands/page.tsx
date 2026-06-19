import { Suspense } from "react";
import { Info, Package } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Pagination } from "@/components/dashboard/pagination";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { BrandsFilters } from "./_brands-filters";
import { BrandsTable } from "./_brands-table";
import { listSkus, getItemGroups } from "@/lib/queries/brands";
import { brandsFilterSchema } from "@/lib/filters/schema";
import { parseSearchParams } from "@/lib/filters/parse";
import { formatKES } from "@/lib/formatters";

interface Props {
  searchParams: Promise<Record<string, string | string[]>>;
}

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
