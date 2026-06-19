import { Wallet, Users, FileText, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
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
import { getSuppliersKpis, listSuppliers } from "@/lib/queries/suppliers";
import { getApKpis, listApInvoices, listPurchaseOrders } from "@/lib/queries/payables";
import { formatKES, formatDate } from "@/lib/formatters";

function EmptySection({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="mb-2 h-8 w-8 text-slate-200" />
      <p className="text-sm text-slate-400">
        No {label} yet — data will appear after the first sync.
      </p>
    </div>
  );
}

export default async function PayablesPage() {
  const [supplierKpis, apKpis, { rows: suppliers }, { rows: apInvoices, total: apTotal }, { rows: purchaseOrders, total: poTotal }] =
    await Promise.all([
      getSuppliersKpis(),
      getApKpis(),
      listSuppliers({ sort: "balance", sortDir: "desc", activeOnly: false }),
      listApInvoices({ status: "O" }),
      listPurchaseOrders({ status: "O" }),
    ]);

  const hasSuppliers = suppliers.length > 0;
  const hasApInvoices = apInvoices.length > 0;
  const hasPurchaseOrders = purchaseOrders.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Payables" subtitle="Suppliers · A/P Invoices · Purchase Orders" />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiStat
          label="Total Payables (balance)"
          value={formatKES(supplierKpis.totalPayables)}
          icon={Wallet}
        />
        <KpiStat
          label="Open A/P Invoices"
          value={`${apKpis.openApCount.toLocaleString()} · ${formatKES(apKpis.openApTotal)}`}
          icon={FileText}
        />
        <KpiStat
          label="Open Purchase Orders"
          value={`${apKpis.openPoCount.toLocaleString()} · ${formatKES(apKpis.openPoTotal)}`}
          icon={ShoppingCart}
        />
        <KpiStat
          label="Active Suppliers"
          value={supplierKpis.activeSuppliers.toLocaleString()}
          icon={Users}
        />
      </div>

      {/* ── Suppliers ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Suppliers — {supplierKpis.totalSuppliers.toLocaleString()} total
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!hasSuppliers ? (
            <EmptySection icon={Users} label="suppliers" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">Supplier</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Country</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Currency</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Balance</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.card_code} className="border-slate-100 hover:bg-slate-50">
                    <TableCell>
                      <p className="font-medium text-slate-900">{s.card_name ?? s.card_code}</p>
                      <span className="font-mono text-[10px] text-slate-400">{s.card_code}</span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{s.country ?? "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{s.currency ?? "KES"}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-slate-900">
                      {formatKES(s.balance)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium " +
                          (s.valid
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500")
                        }
                      >
                        {s.valid ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Open A/P Invoices ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Open A/P Invoices — {apTotal.toLocaleString()} total
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!hasApInvoices ? (
            <EmptySection icon={FileText} label="A/P invoices" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">Doc #</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Supplier</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Due</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Total</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Paid</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apInvoices.map((inv) => (
                  <TableRow key={inv.doc_entry} className="border-slate-100 hover:bg-slate-50">
                    <TableCell className="font-mono text-sm text-slate-700">
                      {inv.doc_num ?? inv.doc_entry}
                    </TableCell>
                    <TableCell className="text-sm text-slate-900">{inv.card_code}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(inv.doc_date)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {inv.doc_due_date ? formatDate(inv.doc_due_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-slate-900">
                      {formatKES(inv.doc_total)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-slate-500">
                      {formatKES(inv.paid_to_date)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-amber-700">
                      {formatKES(inv.outstanding)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Open Purchase Orders ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Open Purchase Orders — {poTotal.toLocaleString()} total
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!hasPurchaseOrders ? (
            <EmptySection icon={ShoppingCart} label="purchase orders" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">PO #</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Supplier</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Due</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">
                    PO Value
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.doc_entry} className="border-slate-100 hover:bg-slate-50">
                    <TableCell className="font-mono text-sm text-slate-700">
                      {po.doc_num ?? po.doc_entry}
                    </TableCell>
                    <TableCell className="text-sm text-slate-900">{po.card_code}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(po.doc_date)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {po.doc_due_date ? formatDate(po.doc_due_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-slate-900">
                      {formatKES(po.doc_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
