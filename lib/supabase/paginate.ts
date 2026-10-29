// PostgREST caps every response at 1000 rows (max_rows), silently truncating
// larger reads. Pages through with .range() until a short page comes back.
// `build` must return a fresh, stably-ordered query for each page.
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

export async function fetchAllRows<T>(
  label: string,
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}
