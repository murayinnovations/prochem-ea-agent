/**
 * POST /api/management-accounts/upload
 *
 * Accepts a multipart/form-data upload of the finance team's monthly
 * management-accounts workbook (.xlsx/.xls), stores the original file
 * in Supabase Storage, parses all 7 sheets, and upserts the result.
 * Re-uploading the same reporting month replaces that month's rows
 * rather than duplicating them.
 *
 * Body: multipart/form-data with a `file` field.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { parseManagementAccountsWorkbook } from "@/lib/management-accounts/parser";
import { upsertManagementAccountsUpload } from "@/lib/management-accounts/store";
import { MANAGEMENT_ACCOUNTS_LIST_TAG, MANAGEMENT_ACCOUNTS_DETAIL_TAG, MANAGEMENT_ACCOUNTS_TRENDS_TAG } from "@/lib/queries/management-accounts";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const STORAGE_BUCKET = "management-accounts";

const fileNameSchema = z.string().refine(
  (name) => ALLOWED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
  { message: `File must be one of: ${ALLOWED_EXTENSIONS.join(", ")}` },
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ data: null, error: "No file provided (expected form field 'file')." }, { status: 400 });
    }

    const nameCheck = fileNameSchema.safeParse(file.name);
    if (!nameCheck.success) {
      return NextResponse.json({ data: null, error: nameCheck.error.issues[0].message }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const parsed = parseManagementAccountsWorkbook(buffer, file.name);

    if (!parsed.periodMonth) {
      return NextResponse.json(
        {
          data: null,
          error:
            "Could not determine the reporting period from this workbook. Expected dated monthly columns on the P&L or Cash Flow sheet, or a month name in the filename.",
        },
        { status: 422 },
      );
    }

    const db = createAdminClient();

    const storagePath = `${parsed.periodMonth}/${file.name}`;
    const { error: uploadError } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) {
      return NextResponse.json(
        { data: null, error: `Failed storing workbook: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const result = await upsertManagementAccountsUpload(db, {
      parsed,
      fileName: file.name,
      filePath: storagePath,
      fileSize: buffer.byteLength,
    });

    // Next 16's revalidateTag requires a cache-life profile for the second arg;
    // { expire: 0 } means "treat as stale immediately" for an on-demand purge.
    revalidateTag(MANAGEMENT_ACCOUNTS_LIST_TAG, { expire: 0 });
    revalidateTag(MANAGEMENT_ACCOUNTS_DETAIL_TAG, { expire: 0 });
    revalidateTag(MANAGEMENT_ACCOUNTS_TRENDS_TAG, { expire: 0 });

    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
