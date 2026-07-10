import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteUploadButton } from "@/components/dashboard/management-accounts/delete-upload-button";
import { ManagementAccountsTabs } from "@/components/dashboard/management-accounts/management-accounts-tabs";
import { getManagementAccountsUploadDetail } from "@/lib/queries/management-accounts";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/formatters";

const STORAGE_BUCKET = "management-accounts";
const DOWNLOAD_URL_TTL_SECONDS = 300;

interface Props {
  params: Promise<{ uploadId: string }>;
}

export default async function ManagementAccountsUploadPage({ params }: Props) {
  const { uploadId } = await params;
  const detail = await getManagementAccountsUploadDetail(uploadId);
  if (!detail) notFound();

  const db = createAdminClient();
  const { data: signedUrlData } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(detail.file_path, DOWNLOAD_URL_TTL_SECONDS, { download: detail.file_name });

  const periodLabel = detail.period_label ?? detail.period_month;
  const skippedEntries = Object.entries(detail.skipped_sheets).filter(
    ([, reason]) => !reason.startsWith("Unrecognized sheet name"),
  );

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
        <span className="font-medium text-slate-600">{periodLabel}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: "var(--font-serif, var(--font-geist-sans))" }}
          >
            {periodLabel}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {detail.file_name} · uploaded {formatDateTime(detail.uploaded_at)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {signedUrlData?.signedUrl && (
            <Button variant="outline" asChild>
              <a href={signedUrlData.signedUrl}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download original
              </a>
            </Button>
          )}
          <DeleteUploadButton uploadId={detail.id} periodLabel={periodLabel} />
        </div>
      </div>

      {skippedEntries.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Some sheets in this workbook could not be fully parsed</p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
              {skippedEntries.map(([sheet, reason]) => (
                <li key={sheet}>
                  <span className="font-medium">{sheet}</span> — {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ManagementAccountsTabs
        pnl={detail.pnl}
        cashflow={detail.cashflow}
        agedDebtors={detail.agedDebtors}
        agedCreditors={detail.agedCreditors}
        stockLevels={detail.stockLevels}
        loanFacilities={detail.loanFacilities}
        directorsAccount={detail.directorsAccount}
      />
    </div>
  );
}
