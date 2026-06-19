/**
 * Main sync orchestrator. Run with:
 *   npx tsx src/sync.ts
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  closeSapPool,
  fetchCustomers,
  fetchCustomersWithoutUdfs,
  fetchItems,
  fetchItemsWithoutUdfs,
  fetchInvoices,
  fetchInvoiceLinesForDocs,
  fetchPayments,
  SapCustomer,
  SapItem,
  SapInvoice,
  SapInvoiceLine,
  SapPayment,
} from "./sap-client.js";
import {
  upsertBatched,
  getWatermark,
  setWatermark,
  startLog,
  finishLog,
  getSupabase,
} from "./supabase-client.js";

const UNASSIGNED = "(unassigned)";

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

function maxUpdateDate(rows: { UpdateDate: Date | null }[]): Date | null {
  let max: Date | null = null;
  for (const r of rows) {
    if (!r.UpdateDate) continue;
    const d = new Date(r.UpdateDate);
    if (!max || d > max) max = d;
  }
  return max;
}

async function syncCustomers(runId: string) {
  const entity = "customers";
  const watermark = await getWatermark(entity);
  const logId = await startLog({
    entity, run_id: runId, status: "running",
    watermark_before: watermark?.toISOString(),
  });
  try {
    let rows: SapCustomer[];
    let hasUdfs = true;
    try {
      rows = await fetchCustomers(watermark ?? undefined);
    } catch (e: any) {
      if (String(e?.message ?? e).includes("Invalid column name")) {
        console.log("  [customers] UDFs not present, falling back to base columns");
        rows = await fetchCustomersWithoutUdfs(watermark ?? undefined);
        hasUdfs = false;
      } else {
        throw e;
      }
    }
    console.log(`  [customers] read ${rows.length} rows from SAP (UDFs: ${hasUdfs})`);

    const mapped = rows.map((r) => ({
      card_code: r.CardCode,
      card_name: r.CardName ?? r.CardCode,
      card_type: r.CardType,
      group_code: r.GroupCode,
      country: r.Country,
      currency: r.Currency ?? "KES",
      credit_line: r.CreditLine,
      balance: r.Balance,
      valid: asBool(r.validFor),
      u_cluster: r.U_Cluster,
      u_channel: r.U_Channel,
      u_sales_group: r.U_SalesGroup,
      sap_create_date: safeDate(r.CreateDate),
      sap_update_date: safeDate(r.UpdateDate),
      synced_at: new Date().toISOString(),
    }));

    const upserted = await upsertBatched("customers", mapped, "card_code");
    const newMax = maxUpdateDate(rows);
    if (newMax) await setWatermark(entity, newMax);

    await finishLog(logId, {
      status: "success", rows_read: rows.length, rows_upserted: upserted,
      watermark_after: newMax?.toISOString(),
    });
    return { rows: rows.length, upserted };
  } catch (err: any) {
    await finishLog(logId, { status: "failed", error_message: err.message });
    throw err;
  }
}

async function syncItems(runId: string) {
  const entity = "items";
  const watermark = await getWatermark(entity);
  const logId = await startLog({
    entity, run_id: runId, status: "running",
    watermark_before: watermark?.toISOString(),
  });
  try {
    let rows: SapItem[];
    try {
      rows = await fetchItems(watermark ?? undefined);
    } catch (e: any) {
      if (String(e?.message ?? e).includes("Invalid column name")) {
        console.log("  [items] UDFs not present, falling back");
        rows = await fetchItemsWithoutUdfs(watermark ?? undefined);
      } else {
        throw e;
      }
    }
    console.log(`  [items] read ${rows.length} rows from SAP`);

    const mapped = rows.map((r) => ({
      item_code: r.ItemCode,
      item_name: r.ItemName ?? r.ItemCode,
      items_group_code: r.ItmsGrpCod,
      items_group_name: r.ItmsGrpNam,
      u_brand: r.U_Brand,
      u_category: r.U_Category,
      inventory_uom: r.InvntryUom ?? "MT",
      sales_uom: r.SalUnitMsr,
      valid: asBool(r.validFor),
      sap_create_date: safeDate(r.CreateDate),
      sap_update_date: safeDate(r.UpdateDate),
      synced_at: new Date().toISOString(),
    }));

    const upserted = await upsertBatched("items", mapped, "item_code");
    const newMax = maxUpdateDate(rows);
    if (newMax) await setWatermark(entity, newMax);

    await finishLog(logId, {
      status: "success", rows_read: rows.length, rows_upserted: upserted,
      watermark_after: newMax?.toISOString(),
    });
    return { rows: rows.length, upserted };
  } catch (err: any) {
    await finishLog(logId, { status: "failed", error_message: err.message });
    throw err;
  }
}

async function syncInvoices(runId: string) {
  const entity = "invoices";
  const watermark = await getWatermark(entity);
  const logId = await startLog({
    entity, run_id: runId, status: "running",
    watermark_before: watermark?.toISOString(),
  });
  try {
    const rows = await fetchInvoices(watermark ?? undefined);
    console.log(`  [invoices] read ${rows.length} rows from SAP`);

    const cardCodes = [...new Set(rows.map((r) => r.CardCode))];
    let customerLookup = new Map<string, { cluster?: string; channel?: string }>();
    if (cardCodes.length > 0) {
      const { data: custData } = await getSupabase()
        .from("customers")
        .select("card_code, u_cluster, u_channel")
        .in("card_code", cardCodes);
      customerLookup = new Map(
        (custData ?? []).map((c: any) => [c.card_code, { cluster: c.u_cluster, channel: c.u_channel }])
      );
    }

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
    const newMax = maxUpdateDate(rows);
    if (newMax) await setWatermark(entity, newMax);

    if (rows.length > 0) {
      const docEntries = rows.map((r) => r.DocEntry);
      const lineBatchSize = 500;
      let allLines: SapInvoiceLine[] = [];
      for (let i = 0; i < docEntries.length; i += lineBatchSize) {
        const slice = docEntries.slice(i, i + lineBatchSize);
        const lines = await fetchInvoiceLinesForDocs(slice);
        allLines = allLines.concat(lines);
      }
      console.log(`  [invoice_lines] read ${allLines.length} lines`);

      const itemCodes = [...new Set(allLines.map((l) => l.ItemCode))];
      const { data: itemData } = await getSupabase()
        .from("items")
        .select("item_code, u_brand, u_category")
        .in("item_code", itemCodes);
      const itemLookup = new Map(
        (itemData ?? []).map((i: any) => [i.item_code, { brand: i.u_brand, category: i.u_category }])
      );
      const invoiceLookup = new Map(
        mapped.map((inv) => [inv.doc_entry, { doc_date: inv.doc_date, cluster: inv.cluster }])
      );

      const lineMapped = allLines.map((l) => {
        const item = itemLookup.get(l.ItemCode) ?? {};
        const inv = invoiceLookup.get(l.DocEntry) ?? {};
        return {
          doc_entry: l.DocEntry,
          line_num: l.LineNum,
          item_code: l.ItemCode,
          quantity: l.Quantity,
          price: l.Price,
          line_total: l.LineTotal,
          line_total_sys: l.TotalSumSy,
          brand: item.brand ?? null,
          category: item.category ?? null,
          doc_date: inv.doc_date ?? null,
          cluster: inv.cluster ?? null,
        };
      });

      await upsertBatched("invoice_lines", lineMapped, "doc_entry,line_num");
    }

    await finishLog(logId, {
      status: "success", rows_read: rows.length, rows_upserted: upserted,
      watermark_after: newMax?.toISOString(),
    });
    return { rows: rows.length, upserted };
  } catch (err: any) {
    await finishLog(logId, { status: "failed", error_message: err.message });
    throw err;
  }
}

async function syncPayments(runId: string) {
  const entity = "payments";
  const watermark = await getWatermark(entity);
  const logId = await startLog({
    entity, run_id: runId, status: "running",
    watermark_before: watermark?.toISOString(),
  });
  try {
    const rows = await fetchPayments(watermark ?? undefined);
    console.log(`  [payments] read ${rows.length} rows from SAP`);

    const mapped = rows.map((r) => ({
      doc_entry: r.DocEntry,
      card_code: r.CardCode,
      doc_date: safeDateOnly(r.DocDate)!,
      doc_total: r.DocTotal,
      doc_total_sys: r.DocTotalFC ?? r.DocTotal,
      doc_currency: r.DocCurr ?? "KES",
      cancelled: asBool(r.Canceled),
      sap_create_date: safeDate(r.CreateDate),
      sap_update_date: safeDate(r.UpdateDate),
      synced_at: new Date().toISOString(),
    }));

    const upserted = await upsertBatched("payments", mapped, "doc_entry");
    const newMax = maxUpdateDate(rows);
    if (newMax) await setWatermark(entity, newMax);

    await finishLog(logId, {
      status: "success", rows_read: rows.length, rows_upserted: upserted,
      watermark_after: newMax?.toISOString(),
    });
    return { rows: rows.length, upserted };
  } catch (err: any) {
    await finishLog(logId, { status: "failed", error_message: err.message });
    throw err;
  }
}

async function refreshDailySalesSummary() {
  console.log("  [daily_sales_summary] refreshing aggregate...");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const db = getSupabase();
  const { data, error } = await db
    .from("invoice_lines")
    .select("doc_date, cluster, brand, category, line_total_sys, quantity, doc_entry")
    .gte("doc_date", cutoffStr);
  if (error) throw new Error(`Read invoice_lines: ${error.message}`);

  type Key = string;
  const groups = new Map<Key, {
    date: string; cluster: string; channel: string;
    category: string; brand: string;
    revenue_kes: number; volume_mt: number; invoice_count: Set<number>;
  }>();
  for (const r of data ?? []) {
    // Coalesce nulls so the PK never has null values
    const cluster = r.cluster ?? UNASSIGNED;
    const channel = UNASSIGNED;  // not denormalized yet, always unassigned
    const category = r.category ?? UNASSIGNED;
    const brand = r.brand ?? UNASSIGNED;
    const key = `${r.doc_date}|${cluster}|${channel}|${category}|${brand}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        date: r.doc_date, cluster, channel, category, brand,
        revenue_kes: 0, volume_mt: 0, invoice_count: new Set(),
      };
      groups.set(key, g);
    }
    g.revenue_kes += Number(r.line_total_sys ?? 0);
    g.volume_mt += Number(r.quantity ?? 0);
    g.invoice_count.add(r.doc_entry);
  }

  const rows = [...groups.values()].map((g) => ({
    date: g.date,
    cluster: g.cluster,
    channel: g.channel,
    category: g.category,
    brand: g.brand,
    revenue_kes: g.revenue_kes,
    volume_mt: g.volume_mt,
    invoice_count: g.invoice_count.size,
  }));

  if (rows.length > 0) {
    await upsertBatched("daily_sales_summary", rows, "date,cluster,channel,category,brand");
  }
  console.log(`  [daily_sales_summary] upserted ${rows.length} aggregate rows`);
}

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();
  console.log(`\n=== Sync run ${runId} starting at ${new Date().toISOString()} ===\n`);

  try {
    console.log("→ customers");
    await syncCustomers(runId);

    console.log("→ items");
    await syncItems(runId);

    console.log("→ invoices (+ lines)");
    await syncInvoices(runId);

    console.log("→ payments");
    await syncPayments(runId);

    console.log("→ refreshing aggregates");
    await refreshDailySalesSummary();

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n✓ Sync complete in ${elapsed}s\n`);
  } catch (err: any) {
    console.error("\n✗ Sync failed:", err.message);
    process.exitCode = 1;
  } finally {
    await closeSapPool();
  }
}

main();
