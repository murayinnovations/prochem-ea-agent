import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, DollarSign, BarChart2, Clock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { MonthlyRevenueChart } from "@/components/charts/monthly-revenue-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { getSkuDetail, getSkuVolumeTrend } from "@/lib/queries/brands";
import { formatKES, formatDate } from "@/lib/formatters";

interface Props {
  params: Promise<{ item_code: string }>;
}

export default async function SkuDetailPage({ params }: Props) {
  const { item_code } = await params;
  const code = decodeURIComponent(item_code);

  const [sku, weeklyTrend] = await Promise.all([
    getSkuDetail(code),
    getSkuVolumeTrend(code, 12),
  ]);

  if (!sku) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/brands"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Brands
        </Link>
      </div>

      <PageHeader
        title={sku.item_name ?? sku.item_code}
        subtitle={sku.item_code}
        actions={<StatusBadge variant={sku.valid ? "active" : "inactive"} />}
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiStat label="Revenue (12mo)" value={formatKES(sku.revenue12mo)} icon={DollarSign} />
        <KpiStat label="Volume (12mo)" value={sku.volume12mo.toLocaleString()} icon={BarChart2} />
        <KpiStat label="Customers" value={sku.customer_count.toLocaleString()} icon={Package} />
        <KpiStat
          label="Last sold"
          value={sku.last_sold_date ? formatDate(sku.last_sold_date) : "—"}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left — details */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Product Details</h2>
            <dl className="space-y-3 text-sm">
              {sku.items_group_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Item group</span>
                  <span className="font-medium text-slate-900">{sku.items_group_name}</span>
                </div>
              )}
              {sku.inventory_uom && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Unit of measure</span>
                  <span className="text-slate-700">{sku.inventory_uom}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Item code</span>
                <span className="font-mono text-xs text-slate-700">{sku.item_code}</span>
              </div>
            </dl>
          </div>

          {/* Top customers */}
          {sku.top_customers.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Top Customers</h2>
              <div className="space-y-2">
                {sku.top_customers.map((c, i) => (
                  <div key={c.card_code} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs font-medium text-slate-400 w-4">{i + 1}</span>
                      <Link
                        href={`/customers/${encodeURIComponent(c.card_code)}`}
                        className="truncate font-medium text-slate-900 hover:text-amber-700"
                      >
                        {c.card_name ?? c.card_code}
                      </Link>
                    </div>
                    <span className="ml-2 shrink-0 text-slate-600">{formatKES(c.revenue_kes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — charts */}
        <div className="space-y-6 lg:col-span-2">
          {/* Weekly volume trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Weekly sales volume (12 weeks)</h2>
            {weeklyTrend.length > 0 ? (
              <WeeklyVolumeChart data={weeklyTrend} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No sales in the last 12 weeks.</p>
            )}
          </div>

          {/* Monthly revenue trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Product revenue (12 months)</h2>
            {sku.revenue_trend.length > 0 ? (
              <MonthlyRevenueChart data={sku.revenue_trend} color="#f59e0b" />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No sales data in the last 12 months.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
