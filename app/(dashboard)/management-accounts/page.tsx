import Link from "next/link";
import { FileSpreadsheet, TrendingUp, Users2, Boxes, LineChart } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ManagementAccountsUploadButton } from "@/components/dashboard/management-accounts/upload-button";
import { SparklineCard } from "@/components/dashboard/management-accounts/sparkline-card";
import { listManagementAccountsUploads } from "@/lib/queries/management-accounts";
import { formatKES, formatDateTime } from "@/lib/formatters";

// Reads live Supabase data — render per request instead of prerendering at build time.
export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  if (status === "success") return null;
  const styles =
    status === "partial"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-600";
  return (
    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles}`}>
      {status === "partial" ? "Partially parsed" : "Failed"}
    </span>
  );
}

export default async function ManagementAccountsPage() {
  // Caught here rather than thrown: production redacts thrown messages, and
  // the Supabase error is what's needed to diagnose a failed load.
  let uploads: Awaited<ReturnType<typeof listManagementAccountsUploads>> = [];
  let loadError: string | null = null;
  try {
    uploads = await listManagementAccountsUploads();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }
  const hasUploads = uploads.length > 0;
  const hasTrend = uploads.length >= 2;

  // Uploads come back period_month desc — sparklines want chronological order.
  const ascending = [...uploads].reverse();

  return (
    <div>
      <PageHeader
        title="Management Accounts"
        subtitle="Monthly finance packs — historical archive"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/management-accounts/trends">
                <LineChart className="mr-1.5 h-3.5 w-3.5" />
                Trends
              </Link>
            </Button>
            <ManagementAccountsUploadButton />
          </>
        }
      />

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load management accounts</p>
          <p className="mt-1 font-mono text-xs">{loadError}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Historical Packs — {uploads.length.toLocaleString()} uploaded
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!hasUploads ? (
            <EmptyState
              icon={FileSpreadsheet}
              heading="No management accounts uploaded yet"
              body="Click Upload to add the first month."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-600">Month</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Uploaded on</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Uploaded by</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Revenue</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">AR outstanding</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Stock value</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id} className="border-slate-100 hover:bg-slate-50">
                    <TableCell>
                      <p className="font-medium text-slate-900">{u.period_label ?? u.period_month}</p>
                      {statusBadge(u.status)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDateTime(u.uploaded_at)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{u.uploaded_by ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-slate-900">
                      {u.revenue_kes != null ? formatKES(u.revenue_kes) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-slate-900">
                      {formatKES(u.ar_outstanding_kes)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-slate-900">
                      {formatKES(u.stock_value_kes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/management-accounts/${u.id}`}
                        className="text-sm font-medium text-amber-700 hover:text-amber-800"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        {hasTrend ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SparklineCard
              title="Gross Turnover"
              icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
              data={ascending.map((u) => ({ month: u.period_month, value: u.revenue_kes ?? 0 }))}
            />
            <SparklineCard
              title="Total AR Outstanding"
              icon={<Users2 className="h-4 w-4 text-amber-500" />}
              data={ascending.map((u) => ({ month: u.period_month, value: u.ar_outstanding_kes }))}
            />
            <SparklineCard
              title="Total Stock Value"
              icon={<Boxes className="h-4 w-4 text-amber-500" />}
              data={ascending.map((u) => ({ month: u.period_month, value: u.stock_value_kes }))}
            />
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-400">
            Trends will appear once you have at least 2 months uploaded.
          </p>
        )}
      </div>
    </div>
  );
}
