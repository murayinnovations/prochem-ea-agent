import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export interface StockSummary {
  item_code: string;
  item_name: string | null;
  items_group_name: string | null;
  inventory_uom: string | null;
  total_on_hand: number;
  total_committed: number;
  total_on_order: number;
  total_available: number;
  warehouse_count: number;
}

export interface StockTrendPoint {
  snapshot_at: string;
  on_hand: number;
  available: number;
}

export const getCurrentStock = unstable_cache(
  async (filters: { search?: string; whs_code?: string } = {}): Promise<{
    items: StockSummary[];
    snapshot_at: string | null;
  }> => {
    const supabase = createAdminClient();

    const { data: latestRow } = await supabase
      .from("stock_snapshots")
      .select("snapshot_at")
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestRow) return { items: [], snapshot_at: null };

    const snapshotAt = latestRow.snapshot_at as string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("stock_snapshots")
      .select("item_code, whs_code, on_hand, committed, on_order, available")
      .eq("snapshot_at", snapshotAt);

    if (filters.whs_code) q = q.eq("whs_code", filters.whs_code);

    const { data } = await q;
    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const map = new Map<string, StockSummary>();
    for (const r of rows) {
      const code = r.item_code as string;
      const prev = map.get(code) ?? {
        item_code: code,
        item_name: null,
        items_group_name: null,
        inventory_uom: null,
        total_on_hand: 0,
        total_committed: 0,
        total_on_order: 0,
        total_available: 0,
        warehouse_count: 0,
      };
      map.set(code, {
        ...prev,
        total_on_hand: prev.total_on_hand + Number(r.on_hand ?? 0),
        total_committed: prev.total_committed + Number(r.committed ?? 0),
        total_on_order: prev.total_on_order + Number(r.on_order ?? 0),
        total_available: prev.total_available + Number(r.available ?? 0),
        warehouse_count: prev.warehouse_count + 1,
      });
    }

    const codes = Array.from(map.keys());
    if (codes.length === 0) return { items: [], snapshot_at: snapshotAt };

    const { data: itemData } = await supabase
      .from("items")
      .select("item_code, item_name, items_group_name, inventory_uom")
      .in("item_code", codes.slice(0, 1000));

    for (const item of itemData ?? []) {
      const entry = map.get(item.item_code as string);
      if (entry) {
        entry.item_name = item.item_name as string | null;
        entry.items_group_name = item.items_group_name as string | null;
        entry.inventory_uom = item.inventory_uom as string | null;
      }
    }

    let items = Array.from(map.values()).sort(
      (a, b) => b.total_on_hand - a.total_on_hand
    );

    if (filters.search) {
      const sq = filters.search.toLowerCase();
      items = items.filter(
        (r) =>
          r.item_code.toLowerCase().includes(sq) ||
          (r.item_name?.toLowerCase().includes(sq) ?? false)
      );
    }

    return { items, snapshot_at: snapshotAt };
  },
  ["stock-current"],
  { revalidate: 300 },
);

export const getStockTrend = unstable_cache(
  async (item_code: string, days = 30): Promise<StockTrendPoint[]> => {
    const supabase = createAdminClient();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await supabase
      .from("stock_snapshots")
      .select("snapshot_at, on_hand, available")
      .eq("item_code", item_code)
      .gte("snapshot_at", since.toISOString())
      .order("snapshot_at", { ascending: true });

    return (data ?? []).map((r) => ({
      snapshot_at: r.snapshot_at as string,
      on_hand: Number(r.on_hand ?? 0),
      available: Number(r.available ?? 0),
    }));
  },
  ["stock-trend"],
  { revalidate: 300 },
);

export const getLowStockItems = unstable_cache(
  async (threshold = 0, limit = 20): Promise<StockSummary[]> => {
    const { items } = await getCurrentStock();
    return items.filter((r) => r.total_available <= threshold).slice(0, limit);
  },
  ["stock-low"],
  { revalidate: 300 },
);

export const getStockWarehouses = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient();

    const { data: latestRow } = await supabase
      .from("stock_snapshots")
      .select("snapshot_at")
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestRow) return [];

    const { data } = await supabase
      .from("stock_snapshots")
      .select("whs_code")
      .eq("snapshot_at", latestRow.snapshot_at as string)
      .not("whs_code", "is", null);

    const set = new Set<string>();
    for (const r of data ?? []) if (r.whs_code) set.add(r.whs_code as string);
    return Array.from(set).sort();
  },
  ["stock-warehouses"],
  { revalidate: 600 },
);
