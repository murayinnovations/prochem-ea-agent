/**
 * Direct REST client for Supabase, bypassing @supabase/supabase-js entirely.
 * Uses undici (Node 16+ compatible) for HTTP. No WebSocket, no Realtime, no
 * Headers polyfill needed — just plain HTTP against PostgREST.
 *
 * Docs: https://postgrest.org/en/stable/api.html
 */

import { fetch } from "undici";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var");
}

const REST_URL = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

function baseHeaders(prefer?: string): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function restRequest(
  method: string,
  path: string,
  body?: unknown,
  prefer?: string
): Promise<any> {
  const url = `${REST_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: baseHeaders(prefer),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${text}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Upsert rows into a table using PostgREST's upsert syntax.
 * onConflict can be a single column ("card_code") or composite ("doc_entry,line_num").
 */
export async function upsertBatched<T extends object>(
  table: string,
  rows: T[],
  onConflict: string,
  batchSize = 500
): Promise<number> {
  if (rows.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const path = `/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
    try {
      await restRequest(
        "POST",
        path,
        batch,
        "resolution=merge-duplicates,return=minimal"
      );
    } catch (err: any) {
      throw new Error(
        `Upsert into ${table} failed at batch ${i}-${i + batch.length}: ${err.message}`
      );
    }
    total += batch.length;
  }
  return total;
}

/**
 * Select rows from a table.
 *  selectQuery: comma-separated column list, e.g. "card_code,u_cluster,u_channel"
 *  filters: object of column → value for .eq filters
 *  inFilter: { column, values } for an .in filter
 *  gteFilter: { column, value } for >= filter
 */
export async function selectRows<T = any>(
  table: string,
  opts: {
    select?: string;
    eq?: Record<string, string | number | boolean>;
    in?: { column: string; values: (string | number)[] };
    gte?: { column: string; value: string | number };
    limit?: number;
    order?: { column: string; ascending?: boolean };
  } = {}
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set("select", opts.select ?? "*");

  if (opts.eq) {
    for (const [col, val] of Object.entries(opts.eq)) {
      params.append(col, `eq.${val}`);
    }
  }
  if (opts.in && opts.in.values.length > 0) {
    // PostgREST: column=in.(val1,val2,val3)
    const values = opts.in.values.map((v) => String(v)).join(",");
    params.append(opts.in.column, `in.(${values})`);
  }
  if (opts.gte) {
    params.append(opts.gte.column, `gte.${opts.gte.value}`);
  }
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.order) {
    const dir = opts.order.ascending === false ? "desc" : "asc";
    params.set("order", `${opts.order.column}.${dir}`);
  }

  const path = `/${table}?${params.toString()}`;
  const result = await restRequest("GET", path);
  return (result ?? []) as T[];
}

/**
 * For the special case of fetching many rows by an IN filter where the list
 * is large (would exceed URL length), we chunk it.
 */
export async function selectRowsByInChunked<T = any>(
  table: string,
  select: string,
  inColumn: string,
  values: (string | number)[],
  chunkSize = 200
): Promise<T[]> {
  if (values.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const rows = await selectRows<T>(table, {
      select,
      in: { column: inColumn, values: chunk },
    });
    out.push(...rows);
  }
  return out;
}

// --- Watermark helpers ---

export async function getWatermark(entity: string): Promise<Date | null> {
  const rows = await selectRows<{ last_update_date: string }>(
    "sync_watermarks",
    {
      select: "last_update_date",
      eq: { entity },
      limit: 1,
    }
  );
  if (rows.length === 0) return null;
  return new Date(rows[0].last_update_date);
}

export async function setWatermark(entity: string, date: Date): Promise<void> {
  const body = [
    {
      entity,
      last_update_date: date.toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const path = `/sync_watermarks?on_conflict=entity`;
  await restRequest(
    "POST",
    path,
    body,
    "resolution=merge-duplicates,return=minimal"
  );
}

// --- Sync log helpers ---

export interface SyncLogEntry {
  id?: number;
  entity: string;
  run_id: string;
  started_at?: string;
  finished_at?: string;
  rows_read?: number;
  rows_upserted?: number;
  rows_failed?: number;
  status: "running" | "success" | "failed";
  error_message?: string;
  watermark_before?: string;
  watermark_after?: string;
}

export async function startLog(
  entry: Omit<SyncLogEntry, "id" | "started_at">
): Promise<number> {
  const body = [{ ...entry, started_at: new Date().toISOString() }];
  const path = `/sync_log?select=id`;
  const rows = (await restRequest(
    "POST",
    path,
    body,
    "return=representation"
  )) as Array<{ id: number }>;
  return rows[0].id;
}

export async function finishLog(
  id: number,
  updates: Partial<SyncLogEntry>
): Promise<void> {
  const path = `/sync_log?id=eq.${id}`;
  try {
    await restRequest(
      "PATCH",
      path,
      { ...updates, finished_at: new Date().toISOString() },
      "return=minimal"
    );
  } catch (err: any) {
    console.error(`Finish log ${id}: ${err.message}`);
  }
}

// --- Compatibility shim for sync.ts ---
// sync.ts uses getSupabase().from(...).select(...).in(...) syntax.
// We provide a minimal stub that mimics that surface.

export function getSupabase() {
  return {
    from(table: string) {
      return {
        _table: table,
        _select: "*",
        _eqs: {} as Record<string, any>,
        _ins: null as null | { column: string; values: any[] },
        _gte: null as null | { column: string; value: any },
        select(cols: string) {
          this._select = cols;
          return this;
        },
        eq(col: string, val: any) {
          this._eqs[col] = val;
          return this;
        },
        in(col: string, vals: any[]) {
          this._ins = { column: col, values: vals };
          return this;
        },
        gte(col: string, val: any) {
          this._gte = { column: col, value: val };
          return this;
        },
        then(resolve: any, reject: any) {
          // Awaiting the query: build the request
          return selectRows(this._table, {
            select: this._select,
            eq: this._eqs,
            in: this._ins ?? undefined,
            gte: this._gte ?? undefined,
          })
            .then((data) => resolve({ data, error: null }))
            .catch((err) => resolve({ data: null, error: err }));
        },
      };
    },
  };
}
