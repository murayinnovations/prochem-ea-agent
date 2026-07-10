/**
 * DELETE /api/management-accounts/[uploadId]
 *
 * Permanently removes an upload: the row itself (child tables cascade via
 * FK), then a best-effort removal of the original workbook from Storage.
 * No auth/role gating yet — this app has no login system in place. Add an
 * admin check here once one exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { MANAGEMENT_ACCOUNTS_LIST_TAG, MANAGEMENT_ACCOUNTS_DETAIL_TAG, MANAGEMENT_ACCOUNTS_TRENDS_TAG } from "@/lib/queries/management-accounts";

export const runtime = "nodejs";

const STORAGE_BUCKET = "management-accounts";

interface Params {
  params: Promise<{ uploadId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { uploadId } = await params;
  const db = createAdminClient();

  const { data: upload, error: fetchError } = await db
    .from("management_accounts_uploads")
    .select("file_path")
    .eq("id", uploadId)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ data: null, error: fetchError.message }, { status: 500 });
  }
  if (!upload) {
    return NextResponse.json({ data: null, error: "Upload not found." }, { status: 404 });
  }

  const { error: deleteError } = await db
    .from("management_accounts_uploads")
    .delete()
    .eq("id", uploadId);
  if (deleteError) {
    return NextResponse.json({ data: null, error: deleteError.message }, { status: 500 });
  }

  // Best-effort — child rows are already gone via ON DELETE CASCADE.
  await db.storage.from(STORAGE_BUCKET).remove([upload.file_path as string]);

  revalidateTag(MANAGEMENT_ACCOUNTS_LIST_TAG, { expire: 0 });
  revalidateTag(MANAGEMENT_ACCOUNTS_DETAIL_TAG, { expire: 0 });
  revalidateTag(MANAGEMENT_ACCOUNTS_TRENDS_TAG, { expire: 0 });

  return NextResponse.json({ data: { deleted: true }, error: null });
}
