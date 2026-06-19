import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign, Calendar, User, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getInvoiceDetail, getInvoiceLines, getPaymentsNearInvoice } from "@/lib/queries/invoices";
import { formatKES, formatKESFull, formatDate } from "@/lib/formatters";

interface Props {
  params: Promise<{ doc_entry: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { doc_entry: docEntryStr } = await params;
  const doc_entry = Number(docEntryStr);
  if (!Number.isInteger(doc_entry)) notFound();

  const [invoice, lines] = await Promise.all([
    getInvoiceDetail(doc_entry),
    getInvoiceLines(doc_entry),
  ]);

  if (!invoice) notFound();

  const payments = await getPaymentsNearInvoice(invoice.card_code, invoice.doc_date);

  const isOverdue =
    invoice.doc_status === "O" &&
    invoice.doc_due_date &&
    new Date(invoice.doc_due_date + "T00:00:00") < new Date();

  const statusVariant = isOverdue
    ? "overdue"
    : invoice.doc_status === "O"
    ? "open"
    : "closed";

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Invoices
        </Link>
      </div>

      <PageHeader
        title={`Invoice #${invoice.doc_num ?? invoice.doc_entry}`}
        subtitle={formatDate(invoice.doc_date)}
        actions={<StatusBadge variant={statusVariant} />}
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiStat label="Invoice total" value={formatKES(invoice.doc_total)} icon={DollarSign} />
        <KpiStat label="Outstanding" value={formatKES(invoice.outstanding)} icon={CreditCard} />
        <KpiStat
          label="Due date"
          value={invoice.doc_due_date ? formatDate(invoice.doc_due_date) : "—"}
          icon={Calendar}
        />
        <KpiStat label="Currency" value={invoice.doc_currency ?? "KES"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left — header info */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <Link
                    href={`/customers/${encodeURIComponent(invoice.card_code)}`}
                    className="font-medium text-slate-900 hover:text-amber-700"
                  >
                    {invoice.card_name ?? invoice.card_code}
                  </Link>
                  <p className="text-xs text-slate-400">{invoice.card_code}</p>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice total</span>
                <span className="font-medium">{formatKESFull(invoice.doc_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="font-medium text-emerald-700">
                  {formatKESFull(invoice.paid_to_date_sys)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="font-medium text-slate-700">Outstanding</span>
                <span className={`font-semibold ${invoice.outstanding > 0 ? "text-amber-700" : "text-slate-400"}`}>
                  {formatKESFull(invoice.outstanding)}
                </span>
              </div>
              {invoice.doc_rate && invoice.doc_rate !== 1 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Exchange rate</span>
                  <span className="font-mono text-xs text-slate-600">{invoice.doc_rate.toFixed(4)}</span>
                </div>
              )}
            </dl>
          </div>

          {/* Payments */}
          {payments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Payments received</h2>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.doc_entry} className="flex justify-between text-sm">
                    <span className="text-slate-500">{formatDate(p.doc_date)}</span>
                    <span className="font-medium text-emerald-700">{formatKES(p.doc_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — line items */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              Line items ({lines.length})
            </h2>
            {lines.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No line items found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-2">#</th>
                      <th className="pb-2">Item</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((line) => (
                      <tr key={line.line_num} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-400">{line.line_num + 1}</td>
                        <td className="py-2">
                          <p className="font-medium text-slate-900">{line.item_name ?? line.item_code}</p>
                          <p className="text-xs text-slate-400">{line.item_code}</p>
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {line.quantity != null ? line.quantity.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {line.price != null ? formatKES(line.price) : "—"}
                        </td>
                        <td className="py-2 text-right font-medium text-slate-900">
                          {formatKES(line.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={4} className="pt-2 text-right text-xs font-medium text-slate-500">
                        TOTAL
                      </td>
                      <td className="pt-2 text-right font-semibold text-slate-900">
                        {formatKES(invoice.doc_total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
