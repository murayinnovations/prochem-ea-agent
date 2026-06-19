import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export interface SupplierRow {
  card_code: string;
  card_name: string | null;
  country: string | null;
  currency: string | null;
  balance: number;
  valid: boolean | null;
  sap_create_date: string | null;
}

export interface SuppliersKpis {
  totalSuppliers: number;
  totalPayables: number;
  activeSuppliers: number;
}

export type ListSuppliersInput = {
  search?: string;
  country?: string;
  activeOnly?: boolean;
  sort?: "name" | "balance";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

// These KPIs are portfolio-wide — never derived from a paginated row set.
export const getSuppliersKpis = unstable_cache(
  async (): Promise<SuppliersKpis> => {
    const supabase = createAdminClient();
    let totalSuppliers = 0;
    let totalPayables = 0;
    let activeSuppliers = 0;

    for (let page = 0; page < 200; page++) {
      const { data } = await supabase
        .from("suppliers")
        .select("balance, valid")
        .range(page * 1000, (page + 1) * 1000 - 1);
      const rows = data ?? [];
      for (const r of rows) {
        totalSuppliers++;
        totalPayables += Number(r.balance ?? 0);
        if (r.valid) activeSuppliers++;
      }
      if (rows.length < 1000) break;
    }

    return { totalSuppliers, totalPayables, activeSuppliers };
  },
  ["suppliers-kpis"],
  { revalidate: 120 },
);

export const listSuppliers = unstable_cache(
  async (input: ListSuppliersInput = {}) => {
    const {
      search,
      country,
      activeOnly = true,
      sort = "name",
      sortDir = "asc",
      page = 1,
      pageSize = 50,
    } = input;
    const supabase = createAdminClient();
    const pageStart = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function af(q: any): any {
      if (activeOnly) q = q.eq("valid", true);
      if (search) q = q.or(`card_name.ilike.%${search}%,card_code.ilike.%${search}%`);
      if (country) q = q.eq("country", country);
      return q;
    }

    // count: 'exact' — never derive count from data.length (PostgREST caps at 1000)
    const { count: exactCount } = await af(
      supabase.from("suppliers").select("*", { count: "exact", head: true })
    );
    const total = exactCount ?? 0;
    if (total === 0) return { rows: [] as SupplierRow[], total: 0 };

    const ascending = sortDir === "asc";
    const orderCol = sort === "balance" ? "balance" : "card_name";

    const { data, error } = await af(
      supabase
        .from("suppliers")
        .select("card_code, card_name, country, currency, balance, valid, sap_create_date")
    )
      .order(orderCol, { ascending, nullsFirst: false })
      .range(pageStart, pageStart + pageSize - 1);

    if (error) throw new Error(`listSuppliers: ${error.message}`);

    const rows: SupplierRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
      card_code: r.card_code as string,
      card_name: r.card_name as string | null,
      country: r.country as string | null,
      currency: r.currency as string | null,
      balance: Number(r.balance ?? 0),
      valid: r.valid as boolean | null,
      sap_create_date: r.sap_create_date as string | null,
    }));

    return { rows, total };
  },
  ["suppliers-list"],
  { revalidate: 60 },
);

export const getSupplierCountries = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("suppliers")
      .select("country")
      .eq("valid", true)
      .not("country", "is", null);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.country) set.add(r.country as string);
    return Array.from(set).sort();
  },
  ["suppliers-countries"],
  { revalidate: 600 },
);
