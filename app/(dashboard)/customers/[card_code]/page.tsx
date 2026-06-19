import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, DollarSign, CreditCard, Clock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { MonthlyRevenueChart } from "@/components/charts/monthly-revenue-chart";
import {
  getCustomerDetail,
  getCustomerRevenueTrend,
  getCustomerARAging,
  getCustomerRecentInvoices,
  getCustomerRecentPayments,
} from "@/lib/queries/customers";
import { formatKES, formatKESFull, formatDate } from "@/lib/formatters";

interface Props {
  params: Promise<{ card_code: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { card_code } = await params;
  const code = decodeURIComponent(card_code);

  const [customer, trend, aging, recentInvoices, recentPayments] = await Promise.all([
    getCustomerDetail(code),
    getCustomerRevenueTrend(code, 12),
    getCustomerARAging(code),
    getCustomerRecentInvoices(code, 20),
    getCustomerRecentPayments(code, 10),
  ]);

  if (!customer) notFound();

  const arTotal = aging.total;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Customers
        </Link>
      </div>

      <PageHeader
        title={customer.card_name ?? customer.card_code}
        subtitle={customer.card_code}
        actions={
          <StatusBadge variant={customer.valid ? "active" : "inactive"} />
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiStat label="Revenue (12mo)" value={formatKES(customer.revenue12mo)} icon={DollarSign} />
        <KpiStat label="Outstanding AR" value={formatKES(customer.ar)} icon={CreditCard} />
        <KpiStat label="Total Invoices" value={customer.totalInvoices.toLocaleString()} />
        <KpiStat
          label="Last Order"
          value={customer.last_order_date ? formatDate(customer.last_order_date) : "—"}
          icon={Clock}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Profile card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Profile</h2>
            <dl className="space-y-3 text-sm">
              {customer.country && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>{customer.country}</span>
                </div>
              )}
              {customer.currency && (
                <div className="flex items-center gap-2 text-slate-600">
                  <DollarSign className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>{customer.currency}</span>
                </div>
              )}
              {(customer.u_cluster || customer.u_channel) && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    {[customer.u_cluster, customer.u_channel].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
              {customer.credit_line != null && customer.credit_line > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Credit limit</span>
                  <span className="font-medium text-slate-900">{formatKESFull(customer.credit_line)}</span>
                </div>
              )}
              {customer.sap_create_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer since</span>
                  <span className="text-slate-700">{formatDate(customer.sap_create_date)}</span>
                </div>
              )}
            </dl>
          </div>

          {/* AR Aging by invoice date */}
          {arTotal > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">AR aging by invoice date</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: "0–30 days", value: aging.b0_30, color: "bg-emerald-400" },
                  { label: "31–60 days", value: aging.b31_60, color: "bg-amber-400" },
                  { label: "61–90 days", value: aging.b61_90, color: "bg-orange-400" },
                  { label: ">90 days", value: aging.b90_plus, color: "bg-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{label}</span>
                      <span>{formatKES(value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${color}`}
                        style={{ width: `${arTotal > 0 ? Math.round((value / arTotal) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-100 pt-2 font-medium">
                  <span className="text-slate-700">Open invoice total</span>
                  <span className="text-amber-700">{formatKES(arTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Payments */}
          {recentPayments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent Payments</h2>
              <div className="space-y-2">
                {recentPayments.map((p) => (
                  <div key={p.doc_entry} className="flex justify-between text-sm">
                    <span className="text-slate-500">{formatDate(p.doc_date)}</span>
                    <span className="font-medium text-slate-900">{formatKES(p.doc_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — trend + invoices */}
        <div className="space-y-6 lg:col-span-2">
          {/* Revenue trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Revenue (12 months)</h2>
            {trend.length > 0 ? (
              <MonthlyRevenueChart data={trend} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No invoice data in the last 12 months.</p>
            )}
          </div>

          {/* Recent invoices */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent Invoices</h2>
            {recentInvoices.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No invoices found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-2">Doc #</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Outstanding</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentInvoices.map((inv) => {
                      const outstanding = Math.max(0, inv.doc_total - inv.paid_to_date_sys);
                      return (
                        <tr key={inv.doc_entry} className="hover:bg-slate-50">
                          <td className="py-2">
                            <Link
                              href={`/invoices/${inv.doc_entry}`}
                              className="font-medium text-slate-900 hover:text-amber-700"
                            >
                              {inv.doc_num ?? inv.doc_entry}
                            </Link>
                          </td>
                          <td className="py-2 text-slate-500">{formatDate(inv.doc_date)}</td>
                          <td className="py-2 text-right font-medium">{formatKES(inv.doc_total)}</td>
                          <td className="py-2 text-right">
                            {outstanding > 0 ? (
                              <span className="text-amber-700">{formatKES(outstanding)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            {inv.doc_status === "O" ? (
                              <StatusBadge variant="open" />
                            ) : (
                              <StatusBadge variant="closed" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
