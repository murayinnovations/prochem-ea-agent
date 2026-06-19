import { Suspense } from "react";
import { FileText, Receipt } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Pagination } from "@/components/dashboard/pagination";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { InvoicesFilters } from "./_invoices-filters";
import { InvoicesTable } from "./_invoices-table";
import { listInvoices } from "@/lib/queries/invoices";
import { invoicesFilterSchema } from "@/lib/filters/schema";
import { parseSearchParams } from "@/lib/filters/parse";
import { formatKES } from "@/lib/formatters";

interface Props {
  searchParams: Promise<Record<string, string | string[]>>;
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = parseSearchParams(invoicesFilterSchema, params);

  const { rows, total, totals } = await listInvoices(filters);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${totals.filtered_count.toLocaleString()} invoice${totals.filtered_count !== 1 ? "s" : ""} · not cancelled`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiStat label="Total (filtered)" value={formatKES(totals.sum_kes)} icon={Receipt} />
        <KpiStat label="Open invoices" value={totals.open_count.toLocaleString()} icon={FileText} />
        <KpiStat label="Open AR" value={formatKES(totals.open_sum_kes)} />
        <KpiStat label="Showing" value={`${rows.length} of ${totals.filtered_count}`} />
      </div>

      <FilterBar>
        <Suspense>
          <InvoicesFilters current={filters} />
        </Suspense>
      </FilterBar>

      <Suspense>
        <InvoicesTable rows={rows} sortKey={filters.sort} sortDir={filters.sortDir} />
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
