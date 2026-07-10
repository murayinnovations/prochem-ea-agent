import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TrendsChart, type TrendSeriesOption } from "@/components/dashboard/management-accounts/trends-chart";
import { getManagementAccountsTrends } from "@/lib/queries/management-accounts";

export default async function ManagementAccountsTrendsPage() {
  const data = await getManagementAccountsTrends();

  const options: TrendSeriesOption[] = [
    ...Object.entries(data.pnl).map(([label, series]) => ({
      group: "P&L Account" as const,
      key: `pnl:${label}`,
      label,
      series,
    })),
    ...Object.entries(data.customers).map(([label, series]) => ({
      group: "Customer (AR)" as const,
      key: `cust:${label}`,
      label,
      series,
    })),
    ...Object.entries(data.stock).map(([label, series]) => ({
      group: "Stock Item" as const,
      key: `stock:${label}`,
      label,
      series,
    })),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-1.5 text-sm">
        <Link
          href="/management-accounts"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Management Accounts
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="font-medium text-slate-600">Trends</span>
      </div>

      <PageHeader
        title="Trends"
        subtitle="Any P&L line, customer AR balance, or stock item — charted across every uploaded month."
      />

      {data.monthsAvailable < 2 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <p className="text-sm font-medium text-slate-600">
            {data.monthsAvailable === 0 ? "No uploads yet" : "Only one month uploaded so far"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Trends need at least 2 uploaded months to plot a line. Upload another month to unlock this page.
          </p>
        </div>
      ) : (
        <TrendsChart options={options} />
      )}
    </div>
  );
}
