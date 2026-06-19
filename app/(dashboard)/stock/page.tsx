import { Boxes, AlertTriangle } from "lucide-react";
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
import { getCurrentStock, getLowStockItems } from "@/lib/queries/stock";
import { formatDate } from "@/lib/formatters";

export default async function StockPage() {
  const [{ items, snapshot_at }, lowStock] = await Promise.all([
    getCurrentStock(),
    getLowStockItems(0, 10),
  ]);

  const totalSkus = items.length;
  const lowStockCount = items.filter((r) => r.total_available <= 0).length;
  const snapshotLabel = snapshot_at
    ? formatDate(snapshot_at.split("T")[0])
    : null;

  return (
    <div>
      <PageHeader
        title="Stock Position"
        subtitle={
          snapshotLabel
            ? `Snapshot as of ${snapshotLabel}`
            : "No snapshot yet"
        }
      />

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Boxes className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            No stock snapshot yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Run the sync agent on PROCHEMSVR to capture inventory positions from
            SAP OITW. Data will appear here automatically after the first sync.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* KPI strip */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <KpiStat label="SKUs tracked" value={totalSkus.toLocaleString()} icon={Boxes} />
            <KpiStat label="Zero / negative available" value={lowStockCount.toLocaleString()} />
            <KpiStat label="Snapshot" value={snapshotLabel ?? "—"} />
          </div>

          {/* Low stock alert */}
          {lowStockCount > 0 && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>
                <strong>{lowStockCount} SKU{lowStockCount !== 1 ? "s" : ""}</strong> have zero
                or negative available stock (on-hand minus committed).
              </p>
            </div>
          )}

          {/* Stock table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700">
                All Stock Positions — {totalSkus.toLocaleString()} SKUs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-600">Item</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">Group</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">On Hand</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">Committed</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">On Order</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">Available</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">UOM</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-slate-600">Whse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 200).map((item) => (
                    <TableRow
                      key={item.item_code}
                      className="border-slate-100 hover:bg-slate-50"
                    >
                      <TableCell className="max-w-[200px]">
                        <p className="truncate font-medium text-slate-900">
                          {item.item_name ?? item.item_code}
                        </p>
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.item_code}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.items_group_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-900">
                        {item.total_on_hand.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-500">
                        {item.total_committed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-500">
                        {item.total_on_order.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={
                          "text-right font-mono text-sm font-semibold " +
                          (item.total_available <= 0
                            ? "text-red-600"
                            : "text-emerald-700")
                        }
                      >
                        {item.total_available.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.inventory_uom ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-400">
                        {item.warehouse_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {items.length > 200 && (
                <p className="px-4 py-3 text-xs text-slate-400">
                  Showing top 200 of {items.length.toLocaleString()} SKUs by on-hand quantity.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
