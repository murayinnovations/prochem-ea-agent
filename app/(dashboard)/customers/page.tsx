import { Suspense } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Pagination } from "@/components/dashboard/pagination";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { CustomersFilters } from "./_customers-filters";
import { CustomersTable } from "./_customers-table";
import { listCustomers, getCustomerCountries, getCustomersPortfolioKpis } from "@/lib/queries/customers";
import { customersFilterSchema } from "@/lib/filters/schema";
import { parseSearchParams } from "@/lib/filters/parse";
import { formatKES } from "@/lib/formatters";

interface Props {
  searchParams: Promise<Record<string, string | string[]>>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = parseSearchParams(customersFilterSchema, params);

  const [{ rows, total }, countries, { rev30Total, arTotal }] = await Promise.all([
    listCustomers(filters),
    getCustomerCountries(),
    getCustomersPortfolioKpis(),
  ]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${total.toLocaleString()} customer${total !== 1 ? "s" : ""}${filters.activeOnly ? " · active only" : ""}`}
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <KpiStat label="Customers shown" value={total.toLocaleString()} icon={Users} />
        <KpiStat label="Revenue (30d)" value={formatKES(rev30Total)} />
        <KpiStat label="Outstanding AR" value={formatKES(arTotal)} />
      </div>

      <FilterBar>
        <Suspense>
          <CustomersFilters current={filters} countries={countries} />
        </Suspense>
      </FilterBar>

      <Suspense>
        <CustomersTable rows={rows} sortKey={filters.sort} sortDir={filters.sortDir} />
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
