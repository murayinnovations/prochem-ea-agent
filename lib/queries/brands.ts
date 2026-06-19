/**
 * Brands query layer.
 * NOTE: SAP brand/category UDFs (u_brand, u_category) are not populated in
 * Prochem's instance. These queries operate on items_group_name + item_code
 * (SKU-level). The /brands route and page title stay as-is.
 */
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { format, subDays, subMonths } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";

// ── Input schemas ─────────────────────────────────────────────────────────────

const listSkusInputSchema = z.object({
  search: z.string().optional(),
  group: z.string().optional(),
  sort: z.enum(["name", "revenue30d", "volume30d"]).default("revenue30d"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type ListSkusInput = z.input<typeof listSkusInputSchema>;

// ── Row types ─────────────────────────────────────────────────────────────────

export interface SkuRow {
  item_code: string;
  item_name: string | null;
  items_group_name: string | null;
  inventory_uom: string | null;
  valid: boolean | null;
  revenue30d: number;
  volume30d: number;
  avg_price30d: number | null;
}

export interface ItemGroupRollup {
  group_name: string;
  sku_count: number;
  revenue_kes: number;
  volume: number;
}

export interface SkuDetail {
  item_code: string;
  item_name: string | null;
  items_group_name: string | null;
  inventory_uom: string | null;
  valid: boolean | null;
  revenue12mo: number;
  volume12mo: number;
  customer_count: number;
  last_sold_date: string | null;
  revenue_trend: { month: string; revenue_kes: number; volume: number }[];
  top_customers: { card_code: string; card_name: string | null; revenue_kes: number; invoice_count: number }[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date();
}

// ── listSkus ──────────────────────────────────────────────────────────────────

export const listSkus = unstable_cache(
  async (input: ListSkusInput) => {
    const f = listSkusInputSchema.parse(input ?? {});
    const supabase = createAdminClient();

    const d30 = format(subDays(today(), 30), "yyyy-MM-dd");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let itemQ: any = supabase.from("items").select("item_code, item_name, items_group_name, inventory_uom, valid");
    if (f.search) itemQ = itemQ.or(`item_name.ilike.%${f.search}%,item_code.ilike.%${f.search}%`);
    if (f.group) itemQ = itemQ.eq("items_group_name", f.group);

    const { data: itemData, error } = await itemQ;
    if (error) throw new Error(`listSkus: ${error.message}`);

    const items = itemData ?? [];
    if (items.length === 0) return { rows: [] as SkuRow[], total: 0 };

    const itemCodes = items.map((i: { item_code: string }) => i.item_code);

    const lineRows: { item_code: string; line_total: number; quantity: number }[] = [];
    for (let i = 0; i < itemCodes.length; i += 200) {
      const { data } = await supabase
        .from("invoice_lines")
        .select("item_code, line_total, quantity")
        .in("item_code", itemCodes.slice(i, i + 200))
        .gte("doc_date", d30);
      for (const r of data ?? []) {
        lineRows.push({ item_code: r.item_code as string, line_total: Number(r.line_total ?? 0), quantity: Number(r.quantity ?? 0) });
      }
    }

    const rev30 = new Map<string, number>();
    const vol30 = new Map<string, number>();
    const cnt30 = new Map<string, number>();
    for (const r of lineRows) {
      rev30.set(r.item_code, (rev30.get(r.item_code) ?? 0) + r.line_total);
      vol30.set(r.item_code, (vol30.get(r.item_code) ?? 0) + r.quantity);
      cnt30.set(r.item_code, (cnt30.get(r.item_code) ?? 0) + 1);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: SkuRow[] = (items as any[]).map((it) => {
      const rev = rev30.get(it.item_code) ?? 0;
      const vol = vol30.get(it.item_code) ?? 0;
      const cnt = cnt30.get(it.item_code) ?? 0;
      return {
        item_code: it.item_code as string,
        item_name: it.item_name as string | null,
        items_group_name: it.items_group_name as string | null,
        inventory_uom: it.inventory_uom as string | null,
        valid: it.valid as boolean | null,
        revenue30d: rev,
        volume30d: vol,
        avg_price30d: cnt > 0 ? rev / cnt : null,
      };
    });

    const dir = f.sortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      switch (f.sort) {
        case "revenue30d": return dir * (a.revenue30d - b.revenue30d);
        case "volume30d":  return dir * (a.volume30d - b.volume30d);
        default:           return dir * (a.item_name ?? a.item_code).localeCompare(b.item_name ?? b.item_code);
      }
    });

    const total = rows.length;
    const start = (f.page - 1) * f.pageSize;
    return { rows: rows.slice(start, start + f.pageSize), total };
  },
  ["brands-skus-list"],
  { revalidate: 300 },
);

// ── getItemGroupRollup ────────────────────────────────────────────────────────

export const getItemGroupRollup = unstable_cache(
  async (days = 30): Promise<ItemGroupRollup[]> => {
    const supabase = createAdminClient();
    const start = format(subDays(today(), days), "yyyy-MM-dd");

    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("item_code, line_total, quantity")
      .gte("doc_date", start);

    if (!lines || lines.length === 0) return [];

    const itemCodes = [...new Set(lines.map((l) => l.item_code as string))];
    const groupMap = new Map<string, string>();
    for (let i = 0; i < itemCodes.length; i += 200) {
      const { data: items } = await supabase
        .from("items")
        .select("item_code, items_group_name")
        .in("item_code", itemCodes.slice(i, i + 200));
      for (const it of items ?? []) groupMap.set(it.item_code as string, it.items_group_name as string ?? "(unassigned)");
    }

    const groups = new Map<string, { revenue: number; volume: number; skus: Set<string> }>();
    for (const l of lines) {
      const group = groupMap.get(l.item_code as string) ?? "(unassigned)";
      const prev = groups.get(group) ?? { revenue: 0, volume: 0, skus: new Set() };
      prev.revenue += Number(l.line_total ?? 0);
      prev.volume += Number(l.quantity ?? 0);
      prev.skus.add(l.item_code as string);
      groups.set(group, prev);
    }

    return Array.from(groups.entries())
      .map(([group_name, g]) => ({
        group_name,
        sku_count: g.skus.size,
        revenue_kes: g.revenue,
        volume: g.volume,
      }))
      .sort((a, b) => b.revenue_kes - a.revenue_kes);
  },
  ["brands-group-rollup"],
  { revalidate: 300 },
);

// ── getSkuDetail ──────────────────────────────────────────────────────────────

export const getSkuDetail = unstable_cache(
  async (item_code: string): Promise<SkuDetail | null> => {
    const supabase = createAdminClient();
    const d12mo = format(subMonths(today(), 12), "yyyy-MM-dd");

    const { data: item } = await supabase
      .from("items")
      .select("item_code, item_name, items_group_name, inventory_uom, valid")
      .eq("item_code", item_code)
      .maybeSingle();

    if (!item) return null;

    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("doc_entry, line_total, quantity, doc_date")
      .eq("item_code", item_code)
      .gte("doc_date", d12mo);

    const allLines = lines ?? [];

    const docEntries = [...new Set(allLines.map((l) => l.doc_entry as number))];
    const cardCodeMap = new Map<number, string>();
    if (docEntries.length > 0) {
      for (let i = 0; i < docEntries.length; i += 200) {
        const { data: invRows } = await supabase
          .from("invoices")
          .select("doc_entry, card_code")
          .in("doc_entry", docEntries.slice(i, i + 200));
        for (const r of invRows ?? []) cardCodeMap.set(r.doc_entry as number, r.card_code as string);
      }
    }

    const cardCodes = [...new Set(Array.from(cardCodeMap.values()))];
    const nameMap = new Map<string, string | null>();
    if (cardCodes.length > 0) {
      const { data: custs } = await supabase
        .from("customers")
        .select("card_code, card_name")
        .in("card_code", cardCodes);
      for (const c of custs ?? []) nameMap.set(c.card_code as string, c.card_name as string | null);
    }

    const revenue12mo = allLines.reduce((s, l) => s + Number(l.line_total ?? 0), 0);
    const volume12mo = allLines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);

    const dates = allLines.map((l) => l.doc_date as string).sort();
    const last_sold_date = dates.length ? dates[dates.length - 1] : null;

    const byMonth = new Map<string, { rev: number; vol: number }>();
    for (const l of allLines) {
      const m = (l.doc_date as string).slice(0, 7);
      const prev = byMonth.get(m) ?? { rev: 0, vol: 0 };
      byMonth.set(m, { rev: prev.rev + Number(l.line_total ?? 0), vol: prev.vol + Number(l.quantity ?? 0) });
    }
    const revenue_trend = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { rev, vol }]) => ({ month, revenue_kes: rev, volume: vol }));

    const custRev = new Map<string, { rev: number; cnt: number }>();
    for (const l of allLines) {
      const cc = cardCodeMap.get(l.doc_entry as number);
      if (!cc) continue;
      const prev = custRev.get(cc) ?? { rev: 0, cnt: 0 };
      custRev.set(cc, { rev: prev.rev + Number(l.line_total ?? 0), cnt: prev.cnt + 1 });
    }
    const top_customers = Array.from(custRev.entries())
      .sort(([, a], [, b]) => b.rev - a.rev)
      .slice(0, 10)
      .map(([cc, { rev, cnt }]) => ({
        card_code: cc,
        card_name: nameMap.get(cc) ?? null,
        revenue_kes: rev,
        invoice_count: cnt,
      }));

    return {
      item_code: item.item_code as string,
      item_name: item.item_name as string | null,
      items_group_name: item.items_group_name as string | null,
      inventory_uom: item.inventory_uom as string | null,
      valid: item.valid as boolean | null,
      revenue12mo,
      volume12mo,
      customer_count: cardCodes.length,
      last_sold_date,
      revenue_trend,
      top_customers,
    };
  },
  ["brands-sku-detail"],
  { revalidate: 300 },
);

// ── getFastMovingSkus ─────────────────────────────────────────────────────────

export interface FastMovingSku {
  item_code: string;
  item_name: string | null;
  items_group_name: string | null;
  inventory_uom: string | null;
  total_volume: number;
  total_revenue: number;
  velocity_per_day: number;
  prior_period_volume: number;
  trend_pct: number | null;
}

export const getFastMovingSkus = unstable_cache(
  async ({ days = 30, limit = 20 }: { days?: number; limit?: number } = {}): Promise<FastMovingSku[]> => {
    const supabase = createAdminClient();
    const now = today();
    const dNow = format(now, "yyyy-MM-dd");
    const dCurrent = format(subDays(now, days), "yyyy-MM-dd");
    const dPrior = format(subDays(now, days * 2), "yyyy-MM-dd");

    const [currRes, priorRes] = await Promise.all([
      supabase
        .from("invoice_lines")
        .select("item_code, quantity, line_total")
        .gte("doc_date", dCurrent)
        .lte("doc_date", dNow),
      supabase
        .from("invoice_lines")
        .select("item_code, quantity")
        .gte("doc_date", dPrior)
        .lt("doc_date", dCurrent),
    ]);

    const currVol = new Map<string, number>();
    const currRev = new Map<string, number>();
    for (const r of currRes.data ?? []) {
      const code = r.item_code as string;
      currVol.set(code, (currVol.get(code) ?? 0) + Number(r.quantity ?? 0));
      currRev.set(code, (currRev.get(code) ?? 0) + Number(r.line_total ?? 0));
    }

    const priorVol = new Map<string, number>();
    for (const r of priorRes.data ?? []) {
      const code = r.item_code as string;
      priorVol.set(code, (priorVol.get(code) ?? 0) + Number(r.quantity ?? 0));
    }

    if (currVol.size === 0) return [];

    const topCodes = Array.from(currVol.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([code]) => code);

    const itemMap = new Map<string, { item_name: string | null; items_group_name: string | null; inventory_uom: string | null }>();
    for (let i = 0; i < topCodes.length; i += 200) {
      const { data } = await supabase
        .from("items")
        .select("item_code, item_name, items_group_name, inventory_uom")
        .in("item_code", topCodes.slice(i, i + 200));
      for (const it of data ?? []) {
        itemMap.set(it.item_code as string, {
          item_name: it.item_name as string | null,
          items_group_name: it.items_group_name as string | null,
          inventory_uom: it.inventory_uom as string | null,
        });
      }
    }

    return topCodes.map((code) => {
      const vol = currVol.get(code) ?? 0;
      const rev = currRev.get(code) ?? 0;
      const priorV = priorVol.get(code) ?? 0;
      const trend_pct = priorV > 0
        ? Math.round(((vol - priorV) / priorV) * 1000) / 10
        : null;
      const item = itemMap.get(code);
      return {
        item_code: code,
        item_name: item?.item_name ?? null,
        items_group_name: item?.items_group_name ?? null,
        inventory_uom: item?.inventory_uom ?? null,
        total_volume: vol,
        total_revenue: rev,
        velocity_per_day: Math.round((vol / days) * 100) / 100,
        prior_period_volume: priorV,
        trend_pct,
      };
    });
  },
  ["brands-fast-moving-skus"],
  { revalidate: 300 },
);

// ── getSkuVolumeTrend ─────────────────────────────────────────────────────────

export interface WeeklyVolumeTrend {
  week_start: string;
  volume: number;
  revenue_kes: number;
}

export const getSkuVolumeTrend = unstable_cache(
  async (item_code: string, weeks = 12): Promise<WeeklyVolumeTrend[]> => {
    const supabase = createAdminClient();
    const start = format(subDays(today(), weeks * 7), "yyyy-MM-dd");

    const { data } = await supabase
      .from("invoice_lines")
      .select("doc_date, quantity, line_total")
      .eq("item_code", item_code)
      .gte("doc_date", start);

    function toWeekStart(dateStr: string): string {
      const d = new Date(dateStr + "T00:00:00Z");
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().split("T")[0];
    }

    const byWeek = new Map<string, { vol: number; rev: number }>();
    for (const r of data ?? []) {
      const ws = toWeekStart(r.doc_date as string);
      const prev = byWeek.get(ws) ?? { vol: 0, rev: 0 };
      byWeek.set(ws, {
        vol: prev.vol + Number(r.quantity ?? 0),
        rev: prev.rev + Number(r.line_total ?? 0),
      });
    }

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, { vol, rev }]) => ({
        week_start,
        volume: vol,
        revenue_kes: rev,
      }));
  },
  ["brands-sku-volume-trend"],
  { revalidate: 300 },
);

// ── getItemGroups ─────────────────────────────────────────────────────────────

export const getItemGroups = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("items")
      .select("items_group_name")
      .not("items_group_name", "is", null);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.items_group_name) set.add(r.items_group_name as string);
    return Array.from(set).sort();
  },
  ["brands-item-groups"],
  { revalidate: 600 },
);
