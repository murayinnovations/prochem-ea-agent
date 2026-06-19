# FMCG Commercial & Treasury Dashboard

A single-client analytics tool that visualizes commercial performance (revenue, brands, MT sales, targets) and treasury position (AR, FX exposure, aging) sourced from SAP Business One. Includes an agentic chatbot that can investigate the data and generate written briefings.

## Architecture

```
SAP B1 Service Layer (REST/OData)
        │  every 30 min, incremental
        ▼
Sync worker (Supabase Edge Function on pg_cron, or Railway worker)
        │
        ▼
Supabase Postgres (warehouse schema, optimized for analytics)
        │
        ├──► Next.js App Router (dashboards, charts) ── Vercel
        │
        └──► Anthropic API (tool-using agent for chat + briefings)
```

**Hard rule:** the frontend and the AI agent never touch SAP directly. They only read from Supabase. SAP is the source, Supabase is the truth.

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Recharts
- **Database & Auth:** Supabase (Postgres + RLS + Auth)
- **AI:** Anthropic SDK, Claude Sonnet 4.6 for chat, Opus 4.7 for scheduled deep briefings
- **SAP client:** Custom TypeScript wrapper around SAP B1 Service Layer
- **Hosting:** Vercel (frontend + API routes), Supabase (DB + edge functions), Railway only if sync worker needs persistent connection
- **PDF export:** Puppeteer in a Next.js route handler

## Data Model (Supabase)

Source-of-truth tables synced from SAP, plus derived/aggregate tables for fast dashboard reads.

### Source tables (mirror SAP)
- `customers` — from `OCRD` (CardCode, CardName, GroupCode, Country, Currency)
- `items` — from `OITM` (ItemCode, ItemName, ItmsGrpCod, brand, category)
- `invoices` — from `OINV` + `INV1` (DocEntry, CardCode, DocDate, DocDueDate, DocTotal, currency)
- `credit_notes` — from `ORIN` + `RIN1`
- `payments` — from `ORCT`
- `journal_entries` — from `OJDT` (for FX revaluation)
- `fx_rates` — from `ORTT` (daily rates)
- `business_partners_aging` — derived view

### Derived / dashboard tables
- `daily_sales_summary` — date, cluster, category, brand, revenue_kes, volume_mt, target_kes, target_mt
- `ar_aging_snapshot` — daily snapshot per customer per bucket (not yet due / 0-7 / 8-14 / 15-21 / 22-30 / 31-60 / 61-90 / 91-120 / 120+)
- `fx_exposure_snapshot` — daily, per currency
- `sync_log` — last sync time per entity, row counts, errors

### App tables
- `users` — Supabase auth
- `chat_sessions`, `chat_messages` — chat history
- `briefings` — generated reports with metadata
- `report_schedules` — cron specs for scheduled briefings

## Agent Tools

The chatbot is a Claude tool-using agent. Each tool is a TypeScript function that runs a parameterized SQL query against Supabase and returns structured JSON. Tools are pure reads — the agent never mutates.

Initial tool set:
1. `get_revenue_summary(period, cluster?, category?)` — totals, vs target, vs prior period
2. `get_top_brands(period, limit, by: "revenue"|"volume")` — ranked list
3. `get_brand_performance(brand, period)` — detail for one brand
4. `get_cluster_breakdown(period)` — revenue/volume by cluster
5. `compare_periods(metric, period_a, period_b)` — variance analysis
6. `get_ar_overview()` — total AR, aging buckets, % overdue
7. `get_top_debtors(limit, bucket?)` — customers by AR
8. `get_fx_exposure()` — FCY balances, % of total AR
9. `get_usd_kes_trend(window_days)` — rate history
10. `search_customers(query)` — fuzzy search by name/code

Each tool has a strict JSON schema. The agent decides which to call. Keep tool count under ~15 — more than that and the model gets indecisive.

## Sync Strategy

- **Full sync** on first run per entity.
- **Incremental** thereafter using SAP's `UpdateDate` field: `?$filter=UpdateDate ge '2026-06-14'`
- Sync order matters: customers → items → invoices → payments → fx_rates → recompute aggregates
- After raw sync, run `refresh_dashboard_aggregates()` SQL function to rebuild `daily_sales_summary` and `ar_aging_snapshot`
- Log every run to `sync_log` with timing and row counts. Surface failures in the admin UI.

## SAP B1 Service Layer Notes

- Endpoint pattern: `https://<host>:50000/b1s/v1/<Resource>`
- Auth: POST to `/Login` with CompanyDB, UserName, Password → returns session cookie. Refresh every ~25 min.
- Pagination: `?$top=100&$skip=0`. Always paginate.
- Rate limit: be polite, 5-10 concurrent max.
- HANA vs SQL: query syntax differs slightly for raw SQL queries via `/SQLQueries`. Stick to OData where possible.

## Build Order

1. Scaffold + Supabase schema + seed data
2. Dashboard pages against seed data (port from Lovable designs)
3. Agent tools + chat UI against seed data
4. SAP sync worker, swap seed → real data
5. Scheduled briefings, PDF export, polish

## Out of Scope (for v1)

- Multi-tenant
- Writing back to SAP
- Mobile app (responsive web only)
- Custom report builder (briefings are agent-generated, not user-configured)
