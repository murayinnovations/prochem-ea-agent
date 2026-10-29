// PostgREST caps every response at 1000 rows (max_rows), silently truncating
// larger reads. Pages through with .range() until a short page comes back.
// `build` must return a fresh, stably-ordered query for each page.
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;
// Pages are requested in parallel waves — sequential paging over ~80k rows
// took 20s+ per cold render. The last wave may overshoot by a few empty pages.
const CONCURRENCY = 8;

export async function fetchAllRows<T>(
  label: string,
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let wave = 0; wave < MAX_PAGES; wave += CONCURRENCY) {
    const pages = Array.from({ length: Math.min(CONCURRENCY, MAX_PAGES - wave) }, (_, i) => wave + i);
    const results = await Promise.all(
      pages.map((page) => build(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)),
    );
    for (const { data, error } of results) {
      if (error) throw new Error(`${label}: ${error.message}`);
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) return out;
    }
  }
  return out;
}
