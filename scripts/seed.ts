import dotenv from "dotenv";
// Load .env.local (Next.js convention); fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import { addDays, format } from "date-fns";

// ── Admin client (mirrors createAdminClient in lib/supabase/server.ts) ──────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Utilities ────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function batchInsert(table: string, rows: object[]): Promise<void> {
  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase.from(table).insert(batch as never[]);
    if (error) throw new Error(`[${table}] insert error: ${error.message}`);
  }
}

async function clearAll(table: string, col: string, useDate: boolean): Promise<void> {
  const { error } = useDate
    ? await supabase.from(table).delete().gte(col, "1900-01-01")
    : await supabase.from(table).delete().not(col, "is", null);
  if (error) throw new Error(`[${table}] clear error: ${error.message}`);
}

function weightedPick<T>(items: { w: number; v: T }[]): T {
  let r = Math.random() * items.reduce((s, x) => s + x.w, 0);
  for (const item of items) {
    r -= item.w;
    if (r <= 0) return item.v;
  }
  return items[items.length - 1].v;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ── Reference data ────────────────────────────────────────────────────────────

const TODAY = "2026-06-15";

const CLUSTERS = ["Nairobi", "Central", "Western", "Coast", "Rift Valley"] as const;

const CLUSTER_W = [
  { w: 35, v: "Nairobi" },
  { w: 20, v: "Central" },
  { w: 20, v: "Rift Valley" },
  { w: 15, v: "Coast" },
  { w: 10, v: "Western" },
] as const;

const CLUSTER_WEIGHT: Record<string, number> = {
  Nairobi: 0.35,
  Central: 0.20,
  "Rift Valley": 0.20,
  Coast: 0.15,
  Western: 0.10,
};

// 9 brand entries in daily_sales_summary:
//   "Ufuta Lite" surfaces as "Ufuta variants (#3)" in the chart — it's a
//   separate product line under the Ufuta family, kept as its own brand row.
const BRANDS: { name: string; category: string; revenueKES: number }[] = [
  { name: "Ufuta",           category: "Edible Oils", revenueKES: 2_700_000_000 },
  { name: "Msafi Detergent", category: "Detergents",  revenueKES: 1_300_000_000 },
  { name: "Ufuta Lite",      category: "Edible Oils", revenueKES: 1_200_000_000 },
  { name: "Msafi",           category: "Detergents",  revenueKES:   961_000_000 },
  { name: "Chipsy",          category: "Snacks",      revenueKES:   779_000_000 },
  { name: "Kimbo",           category: "Edible Oils", revenueKES: 1_800_000_000 },
  { name: "Golden Fry",      category: "Snacks",      revenueKES: 1_200_000_000 },
  { name: "Bahari Fry",      category: "Snacks",      revenueKES:   900_000_000 },
  { name: "Ribena",          category: "Beverages",   revenueKES:   860_000_000 },
  // Total: KES 11,700,000,000 = 11.7B ✓
];

// Approximate MT shipped per KES of revenue (varies by product density/price)
const MT_PER_KES: Record<string, number> = {
  Ufuta: 8.0e-6, "Ufuta Lite": 7.5e-6, Kimbo: 7.0e-6,
  Msafi: 6.5e-6, "Msafi Detergent": 5.5e-6,
  Chipsy: 3.0e-6, "Golden Fry": 4.0e-6, "Bahari Fry": 3.5e-6,
  Ribena: 4.5e-6,
};

// ── 1. Items (~32 SKUs) ───────────────────────────────────────────────────────

function buildItems() {
  type Item = {
    item_code: string;
    item_name: string;
    brand: string;
    category: string;
    uom: string;
    active: boolean;
  };

  const rows: Item[] = [];

  const add = (
    prefix: string,
    brand: string,
    category: string,
    skus: string[],
    label: string
  ) => {
    skus.forEach((sku, i) =>
      rows.push({
        item_code: `${prefix}-${String(i + 1).padStart(3, "0")}`,
        item_name: `${label} ${sku}`,
        brand,
        category,
        uom: "MT",
        active: true,
      })
    );
  };

  // Edible Oils
  add("UFT", "Ufuta",      "Edible Oils", ["1L","2L","3L","5L","10L","20L","25KG","50KG"], "Ufuta Cooking Oil");
  add("UTL", "Ufuta Lite", "Edible Oils", ["1L","2L","5L","10L"],                          "Ufuta Lite Oil");
  add("KMB", "Kimbo",      "Edible Oils", ["500G","1KG","2KG"],                             "Kimbo Cooking Fat");
  // Detergents
  add("MSF", "Msafi",           "Detergents", ["500ML","1L","5L"],    "Msafi Liquid");
  add("MSD", "Msafi Detergent", "Detergents", ["250G","500G","1KG"],  "Msafi Detergent");
  // Snacks
  add("CHP", "Chipsy",    "Snacks", ["20G","50G","100G"], "Chipsy Crisps");
  add("GFR", "Golden Fry","Snacks", ["25G","50G","100G"], "Golden Fry Snacks");
  add("BFR", "Bahari Fry","Snacks", ["25G","50G","100G"], "Bahari Fry Snacks");
  // Beverages
  add("RBN", "Ribena", "Beverages", ["200ML","1L"], "Ribena Blackcurrant");

  return rows; // 32 items
}

// ── 2. Customers (600) ────────────────────────────────────────────────────────

const KENYAN_NAMES = [
  "Kamau","Njoroge","Wanjiku","Kimani","Njeri","Mwangi","Kariuki","Wambui","Gitahi","Muiru",
  "Otieno","Achieng","Odhiambo","Adhiambo","Awuor","Omondi","Akelo","Auma","Okoth","Onyango",
  "Kipchoge","Chebet","Rotich","Bett","Sang","Korir","Mutai","Kiplangat",
  "Mutua","Mwove","Musyoka","Nduku","Nzioki","Mulwa","Munyao",
  "Hassan","Fatuma","Mohamed","Amina","Omar","Abdi","Halima","Yusuf",
];

const BIZ_TYPES = [
  "Supermarket","Stores","Enterprises Ltd","Trading Company","Wholesalers",
  "Distributors","General Merchants","Shop","Mini Mart","Groceries",
  "Holdings Ltd","Suppliers","Commerce Ltd","Traders","Agencies",
];

const TOWNS = [
  "Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos",
  "Kericho","Kisii","Garissa","Kakamega","Malindi","Kitale","Embu",
  "Meru","Nanyuki","Voi","Bungoma","Homa Bay","Migori","Kilifi",
];

function genCardName(): string {
  const r = Math.random();
  const name1 = faker.helpers.arrayElement(KENYAN_NAMES);
  const biz   = faker.helpers.arrayElement(BIZ_TYPES);
  if (r < 0.35) return `${name1} ${biz}`;
  if (r < 0.60) return `${faker.helpers.arrayElement(TOWNS)} ${biz}`;
  return `${name1} & ${faker.helpers.arrayElement(KENYAN_NAMES)} ${biz}`;
}

function buildCustomers() {
  type Customer = {
    card_code: string;
    card_name: string;
    channel: string;
    cluster: string;
    currency: string;
    credit_limit: number;
    active: boolean;
  };

  const special: Customer[] = [
    { card_code: "QMK001", card_name: "Quick Mart Limited",               channel: "MT",       cluster: "Nairobi", currency: "KES", credit_limit: 50_000_000_00, active: true },
    { card_code: "MAF001", card_name: "Majid Al Futaim Hypermarkets Ltd", channel: "MT",       cluster: "Nairobi", currency: "KES", credit_limit: 40_000_000_00, active: true },
    { card_code: "BID001", card_name: "BIDCORO AFRICA LIMITED",           channel: "MT",       cluster: "Nairobi", currency: "KES", credit_limit: 35_000_000_00, active: true },
    { card_code: "SCO001", card_name: "Scooby Enterprises Ltd",           channel: "GT",       cluster: "Central", currency: "KES", credit_limit: 20_000_000_00, active: true },
  ];

  const rest: Customer[] = [];
  for (let i = 5; i <= 600; i++) {
    const cluster  = weightedPick([...CLUSTER_W]);
    const chRoll   = Math.random();
    const channel  = chRoll < 0.20 ? "MT" : chRoll < 0.70 ? "GT" : "Wholesale";
    const curRoll  = Math.random();
    const currency = curRoll < 0.95 ? "KES" : curRoll < 0.99 ? "USD" : "EUR";
    const creditKES = Math.round((500_000 + Math.random() * 9_500_000) * 100); // 500K–10M KES in cents
    rest.push({
      card_code: `C${String(i).padStart(5, "0")}`,
      card_name: genCardName(),
      channel,
      cluster,
      currency,
      credit_limit: creditKES,
      active: true,
    });
  }

  return [...special, ...rest];
}

// ── 3. daily_sales_summary (182 days × 5 clusters × 9 brands = 8,190 rows) ──

function buildSalesSummary() {
  const start   = new Date("2025-12-01");
  const end     = new Date("2026-05-31");
  const numDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1; // 182

  const rows: object[] = [];

  for (let d = 0; d < numDays; d++) {
    const date = format(addDays(start, d), "yyyy-MM-dd");

    for (const { name: brand, category, revenueKES } of BRANDS) {
      for (const cluster of CLUSTERS) {
        const w         = CLUSTER_WEIGHT[cluster];
        const mtPerKes  = MT_PER_KES[brand] ?? 5e-6;

        // Revenue: brand total × cluster share ÷ days × daily noise ±20%
        const revKES    = Math.round(revenueKES * w / numDays * (0.80 + Math.random() * 0.40));
        const revCents  = revKES * 100;

        // Target: revenue / 37% achievement ≈ 2.70× revenue, with light noise
        const tgtKES    = Math.round((revenueKES / 0.37) * w / numDays * (0.90 + Math.random() * 0.20));
        const tgtCents  = tgtKES * 100;

        // Volume in MT
        const volMT     = +(revKES * mtPerKes * (0.90 + Math.random() * 0.20)).toFixed(4);
        const tgtMT     = +(tgtKES * mtPerKes * (0.90 + Math.random() * 0.20)).toFixed(4);

        // Rough invoice count (average invoice ~KES 150k)
        const invoiceCnt = Math.max(1, Math.round((revKES / 150_000) * (0.70 + Math.random() * 0.60)));

        rows.push({
          date, cluster, category, brand,
          revenue_kes:   revCents,
          volume_mt:     volMT,
          target_kes:    tgtCents,
          target_mt:     tgtMT,
          invoice_count: invoiceCnt,
        });
      }
    }
  }

  return rows; // 8,190 rows
}

// ── 4. ar_aging_snapshot (600 rows for TODAY) ─────────────────────────────────

// Target bucket distribution (sums to 1)
const BUCKET_W = [
  { key: "not_yet_due_kes", w: 0.500 },
  { key: "bucket_0_7",      w: 0.060 },
  { key: "bucket_8_14",     w: 0.070 },
  { key: "bucket_15_21",    w: 0.060 },
  { key: "bucket_22_30",    w: 0.080 },
  { key: "bucket_31_60",    w: 0.080 },
  { key: "bucket_61_90",    w: 0.060 },
  { key: "bucket_91_120",   w: 0.004 },
  { key: "bucket_120_plus", w: 0.086 }, // last — absorbs remainder
] as const;

function distributeBuckets(totalKES: number): Record<string, number> {
  const out: Record<string, number> = {};
  let remaining = totalKES;
  const keys = BUCKET_W.map((b) => b.key);

  for (let i = 0; i < keys.length - 1; i++) {
    const { key, w } = BUCKET_W[i];
    const noise  = 0.70 + Math.random() * 0.60; // ±30%
    const amount = Math.min(Math.round(totalKES * w * noise), remaining);
    out[key]   = amount;
    remaining -= amount;
    if (remaining < 0) remaining = 0;
  }
  out[keys[keys.length - 1]] = Math.max(0, remaining); // bucket_120_plus absorbs rest
  return out;
}

function lognormal(meanKES: number, sigma: number): number {
  const mu = Math.log(meanKES) - (sigma * sigma) / 2;
  const u1 = Math.random();
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(Math.exp(mu + sigma * z)));
}

function buildArAging(customers: { card_code: string }[]) {
  const TOTAL_KES = 1_980_000_000; // KES 1.98B

  const SPECIAL_KES: Record<string, number> = {
    QMK001: 120_000_000, // Quick Mart
    MAF001:  95_000_000, // Majid Al Futaim
    BID001:  75_000_000, // BIDCORO
    SCO001:  50_000_000, // Scooby
  };

  const specialSum = Object.values(SPECIAL_KES).reduce((s, v) => s + v, 0); // 340M
  const restCount  = customers.length - Object.keys(SPECIAL_KES).length;    // 596
  const avgRest    = (TOTAL_KES - specialSum) / restCount;                  // ~2.75M

  return customers.map(({ card_code }) => {
    const isSpecial = card_code in SPECIAL_KES;
    const totalKES  = isSpecial ? SPECIAL_KES[card_code] : lognormal(avgRest, 0.8);
    const buckets   = distributeBuckets(totalKES);
    const totalCents = totalKES * 100;

    // Bucket cents must equal total_kes; distributeBuckets ensures sum(values)=totalKES
    return {
      snapshot_date:   TODAY,
      card_code,
      not_yet_due_kes: buckets.not_yet_due_kes * 100,
      bucket_0_7:      buckets.bucket_0_7      * 100,
      bucket_8_14:     buckets.bucket_8_14     * 100,
      bucket_15_21:    buckets.bucket_15_21    * 100,
      bucket_22_30:    buckets.bucket_22_30    * 100,
      bucket_31_60:    buckets.bucket_31_60    * 100,
      bucket_61_90:    buckets.bucket_61_90    * 100,
      bucket_91_120:   buckets.bucket_91_120   * 100,
      bucket_120_plus: buckets.bucket_120_plus * 100,
      total_kes:       totalCents,
    };
  });
}

// ── 5. fx_exposure_snapshot (3 rows for TODAY) ────────────────────────────────

function buildFxExposure() {
  // outstanding_kes in minor units (cents); fcy_amount in original currency
  return [
    {
      snapshot_date:  TODAY,
      currency:       "KES",
      customer_count: 550,
      invoice_count:  4_200,
      outstanding_kes: 2_270_000_000 * 100, // KES 2.27B = 227B cents
      fcy_amount:     2_270_000_000.00,      // KES 2.27B (same currency)
      overdue_kes:      990_000_000 * 100,  // KES 990M overdue
    },
    {
      snapshot_date:  TODAY,
      currency:       "USD",
      customer_count: 24,
      invoice_count:  180,
      outstanding_kes:  103_000_000 * 100,  // KES 103M = 10.3B cents
      fcy_amount:         804_000.00,        // $804k USD
      overdue_kes:       35_000_000 * 100,  // KES 35M overdue
    },
    {
      snapshot_date:  TODAY,
      currency:       "EUR",
      customer_count: 6,
      invoice_count:  42,
      outstanding_kes:    7_900_000 * 100,  // KES 7.9M = 790M cents
      fcy_amount:          52_000.00,        // €52k EUR
      overdue_kes:         2_100_000 * 100, // KES 2.1M overdue
    },
  ];
}

// ── 6. fx_rates (365 days USD/KES, range 128.4–130.7) ────────────────────────

function buildFxRates() {
  const rows: { rate_date: string; currency: string; rate_to_kes: number; source: string }[] = [];
  const rateStart = new Date("2025-06-15");

  let rate = 129.50; // starting mid-range
  const TARGET = 129.55; // mean-reversion anchor

  for (let i = 0; i < 365; i++) {
    const date = format(addDays(rateStart, i), "yyyy-MM-dd");
    rows.push({ rate_date: date, currency: "USD", rate_to_kes: +rate.toFixed(4), source: "SAP" });

    // Mean-reverting walk; noise ±0.15 per day
    const noise     = (Math.random() - 0.5) * 0.30;
    const reversion = (TARGET - rate) * 0.04;
    rate = clamp(rate + reversion + noise, 128.4, 130.7);
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("▶ Starting seed …");

  // Clear in dependency order (children before parents)
  console.log("  Clearing tables …");
  await clearAll("ar_aging_snapshot", "snapshot_date", true);
  await clearAll("invoice_lines",     "doc_entry",     false); // FK child of invoices
  await clearAll("invoices",          "doc_date",      true);
  await clearAll("payments",          "doc_date",      true);
  await clearAll("customers",         "card_code",     false);
  await clearAll("items",             "item_code",     false);
  await clearAll("daily_sales_summary", "date",        true);
  await clearAll("fx_exposure_snapshot","snapshot_date",true);
  await clearAll("fx_rates",          "rate_date",     true);

  // Insert
  const items = buildItems();
  await batchInsert("items", items);
  console.log(`  ✓ Seeded ${items.length} items`);

  const customers = buildCustomers();
  await batchInsert("customers", customers);
  console.log(`  ✓ Seeded ${customers.length} customers`);

  const salesSummary = buildSalesSummary();
  await batchInsert("daily_sales_summary", salesSummary);
  console.log(`  ✓ Seeded daily_sales_summary (${salesSummary.length} rows)`);

  const aging = buildArAging(customers);
  await batchInsert("ar_aging_snapshot", aging);
  console.log(`  ✓ Seeded ar_aging_snapshot (${aging.length} rows)`);

  const fxExposure = buildFxExposure();
  await batchInsert("fx_exposure_snapshot", fxExposure);
  console.log(`  ✓ Seeded fx_exposure_snapshot (${fxExposure.length} rows)`);

  const fxRates = buildFxRates();
  await batchInsert("fx_rates", fxRates);
  console.log(`  ✓ Seeded fx_rates (${fxRates.length} rows)`);

  console.log("✅ Seed complete!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
