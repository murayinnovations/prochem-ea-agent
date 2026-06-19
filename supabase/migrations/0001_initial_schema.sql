-- ============================================================
-- FMCG Dashboard — Initial Schema
-- ============================================================
-- Mirrors key SAP B1 entities + derived aggregates for dashboards.
-- Money stored as bigint in minor units (cents). Format at display.
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;

-- ============================================================
-- SOURCE TABLES (synced from SAP)
-- ============================================================

create table customers (
  card_code         text primary key,           -- SAP CardCode
  card_name         text not null,
  group_code        int,
  country           text,
  currency          text default 'KES',
  sales_group       text,
  channel           text,                       -- MT, GT, Wholesale, etc.
  cluster           text,                       -- 5-cluster model
  credit_limit      bigint,
  active            boolean default true,
  sap_updated_at    timestamptz,
  synced_at         timestamptz default now()
);

create index on customers (cluster);
create index on customers (channel);

create table items (
  item_code         text primary key,           -- SAP ItemCode
  item_name         text not null,
  brand             text,
  category          text,
  uom               text default 'MT',
  active            boolean default true,
  sap_updated_at    timestamptz,
  synced_at         timestamptz default now()
);

create index on items (brand);
create index on items (category);

create table invoices (
  doc_entry         bigint primary key,         -- SAP DocEntry
  doc_num           bigint,
  card_code         text references customers(card_code),
  doc_date          date not null,
  doc_due_date      date,
  doc_total         bigint not null,            -- in minor units, document currency
  doc_total_kes     bigint not null,            -- converted to KES
  currency          text default 'KES',
  fx_rate           numeric(18,6),
  paid_amount_kes   bigint default 0,
  status            text,                       -- O=open, C=closed
  sap_updated_at    timestamptz,
  synced_at         timestamptz default now()
);

create index on invoices (card_code);
create index on invoices (doc_date);
create index on invoices (status) where status = 'O';

create table invoice_lines (
  doc_entry         bigint references invoices(doc_entry) on delete cascade,
  line_num          int not null,
  item_code         text references items(item_code),
  quantity          numeric(18,4),              -- MT
  line_total_kes    bigint,
  primary key (doc_entry, line_num)
);

create index on invoice_lines (item_code);

create table payments (
  doc_entry         bigint primary key,
  card_code         text references customers(card_code),
  doc_date          date not null,
  amount_kes        bigint not null,
  sap_updated_at    timestamptz,
  synced_at         timestamptz default now()
);

create table fx_rates (
  rate_date         date not null,
  currency          text not null,
  rate_to_kes       numeric(18,6) not null,
  source            text default 'SAP',
  primary key (rate_date, currency)
);

-- ============================================================
-- DERIVED / AGGREGATE TABLES (refreshed by sync job)
-- ============================================================

create table daily_sales_summary (
  date              date not null,
  cluster           text,
  category          text,
  brand             text,
  revenue_kes       bigint not null default 0,
  volume_mt         numeric(18,4) not null default 0,
  target_kes        bigint default 0,
  target_mt         numeric(18,4) default 0,
  invoice_count     int default 0,
  primary key (date, cluster, category, brand)
);

create index on daily_sales_summary (date);
create index on daily_sales_summary (brand);

create table ar_aging_snapshot (
  snapshot_date     date not null,
  card_code         text references customers(card_code),
  not_yet_due_kes   bigint default 0,
  bucket_0_7        bigint default 0,
  bucket_8_14       bigint default 0,
  bucket_15_21      bigint default 0,
  bucket_22_30      bigint default 0,
  bucket_31_60      bigint default 0,
  bucket_61_90      bigint default 0,
  bucket_91_120     bigint default 0,
  bucket_120_plus   bigint default 0,
  total_kes         bigint default 0,
  primary key (snapshot_date, card_code)
);

create index on ar_aging_snapshot (snapshot_date);

create table fx_exposure_snapshot (
  snapshot_date     date not null,
  currency          text not null,
  customer_count    int,
  invoice_count     int,
  outstanding_kes   bigint,
  fcy_amount        numeric(20,2),
  overdue_kes       bigint,
  primary key (snapshot_date, currency)
);

-- ============================================================
-- OPS TABLES
-- ============================================================

create table sync_log (
  id                uuid primary key default uuid_generate_v4(),
  entity            text not null,              -- 'customers', 'invoices', etc.
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  rows_upserted     int,
  rows_failed       int default 0,
  status            text not null,              -- 'running', 'success', 'failed'
  error_message     text,
  last_update_date  timestamptz                 -- watermark for incremental sync
);

create index on sync_log (entity, started_at desc);

-- ============================================================
-- APP TABLES (chat, briefings)
-- ============================================================

create table chat_sessions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id),
  title             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table chat_messages (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid references chat_sessions(id) on delete cascade,
  role              text not null,              -- 'user', 'assistant', 'tool'
  content           jsonb not null,             -- full message blocks
  created_at        timestamptz default now()
);

create index on chat_messages (session_id, created_at);

create table briefings (
  id                uuid primary key default uuid_generate_v4(),
  kind              text not null,              -- 'daily_commercial', 'ar_weekly', etc.
  period_start      date,
  period_end        date,
  content           jsonb not null,             -- structured briefing
  markdown          text,                       -- rendered version
  model             text,                       -- which Claude model
  tokens_input      int,
  tokens_output     int,
  generated_at      timestamptz default now()
);

create index on briefings (kind, generated_at desc);

-- ============================================================
-- RLS (single client, but good hygiene)
-- ============================================================

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table briefings enable row level security;

create policy "users see own sessions"
  on chat_sessions for all
  using (auth.uid() = user_id);

create policy "users see own messages"
  on chat_messages for all
  using (exists (
    select 1 from chat_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "authenticated users read briefings"
  on briefings for select
  using (auth.role() = 'authenticated');
