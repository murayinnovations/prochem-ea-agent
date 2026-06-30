/**
 * Backfill invoice headers by DocDate range — bypasses the incremental watermark.
 * Re-fetches and re-upserts invoice rows using the current COALESCE(i.SlpCode, c.SlpCode)
 * query so that slp_code / slp_name are populated from the customer fallback where needed.
 *
 * Does NOT re-fetch invoice_lines (line items don't carry slp attribution).
 * Does NOT touch the sync watermark used by the regular scheduled sync.
 * Safe to re-run — upserts by doc_entry (SAP PK).
 *
 * Usage:
 *   npx tsx src/backfill-invoices.ts --from=2026-06-22 --to=2026-06-28
 *   npx tsx src/backfill-invoices.ts --from=2020-01-01 --to=2026-06-30   # all-time
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { closeSapPool, fetchInvoicesByDocDate } from "./sap-client.js";
import { upsertBatched, startLog, finishLog, getSupabase } from "./supabase-client.js";

function asBool(yn: string | null | undefined): boolean {
  return yn === "Y" || yn === "yTRUE" || yn === "tYES";
}

function safeDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function safeDateOnly(d: Date | string | null | undefined): string | null {
  const iso = safeDate(d);
  return iso ? iso.split("T")[0] : null;
}

function parseArg(args: string[], flag: string): string | undefined {
  const prefix = `--${flag}=`;
  return args.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const args = process.argv.slice(2);
  const fromStr = parseArg(args, "from");
  const toStr = parseArg(args, "to");

  if (!fromStr || !toStr) {
    console.error(
      "Usage: npx tsx src/backfill-invoices.ts --from=YYYY-MM-DD --to=YYYY-MM-DD"
    );
    process.exit(1);
  }

  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59`);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    console.error(`Invalid date: --from=${fromStr} --to=${toStr}`);
    process.exit(1);
  }
  if (from > to) {
    console.error("--from must be before or equal to --to");
    process.exit(1);
  }

  const runId = `backfill-${randomUUID()}`;
  console.log(`\n=== Invoice backfill ${runId}`);
  console.log(`    DocDate range: ${fromStr} → ${toStr}\n`);

  const logId = await startLog({
    entity: "invoices_backfill",
    run_id: runId,
    status: "running",
    watermark_before: `${fromStr}/${toStr}`,
  });

  try {
    const rows = await fetchInvoicesByDocDate(from, to);
    console.log(`  fetched ${rows.length} invoices from SAP`);

    if (rows.length === 0) {
      console.log("  Nothing to upsert.");
      await finishLog(logId, { status: "success", rows_read: 0, rows_upserted: 0 });
      return;
    }

    const cardCodes = [...new Set(rows.map((r) => r.CardCode))];
    const { data: custData } = await getSupabase()
      .from("customers")
      .select("card_code, u_cluster, u_channel")
      .in("card_code", cardCodes);
    const customerLookup = new Map(
      (custData ?? []).map((c: any) => [
        c.card_code,
        { cluster: c.u_cluster, channel: c.u_channel },
      ])
    );

    const mapped = rows.map((r) => {
      const cust = customerLookup.get(r.CardCode) ?? {};
      return {
        doc_entry: r.DocEntry,
        doc_num: r.DocNum,
        card_code: r.CardCode,
        doc_date: safeDateOnly(r.DocDate)!,
        doc_due_date: safeDateOnly(r.DocDueDate),
        doc_total: r.DocTotal,
        doc_total_sys: r.DocTotalSy,
        doc_currency: r.DocCur ?? "KES",
        doc_rate: r.DocRate || 1,
        paid_to_date_sys: r.PaidToDate ?? 0,
        doc_status: r.DocStatus,
        cancelled: asBool(r.CANCELED),
        cluster: cust.cluster ?? null,
        channel: cust.channel ?? null,
        slp_code: r.SlpCode ?? null,
        slp_name: r.SlpName ?? null,
        vat_sum: r.VatSum ?? 0,
        sap_create_date: safeDate(r.CreateDate),
        sap_update_date: safeDate(r.UpdateDate),
        synced_at: new Date().toISOString(),
      };
    });

    const upserted = await upsertBatched("invoices", mapped, "doc_entry");

    const withSlp = mapped.filter((r) => r.slp_code !== null).length;
    const withoutSlp = mapped.length - withSlp;
    console.log(`  upserted ${upserted} rows`);
    console.log(
      `  slp_code resolved: ${withSlp}/${rows.length} — ${withoutSlp} still NULL after OCRD fallback`
    );

    await finishLog(logId, {
      status: "success",
      rows_read: rows.length,
      rows_upserted: upserted,
    });

    console.log(`\n✓ Backfill complete. Watermark unchanged.\n`);
  } catch (err: any) {
    await finishLog(logId, { status: "failed", error_message: err.message });
    console.error("\n✗ Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    await closeSapPool();
  }
}

main();
