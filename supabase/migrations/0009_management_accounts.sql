-- ============================================================
-- Management Accounts — finance's monthly Excel pack, stored as
-- the system of record + basis for later SAP reconciliation.
-- Money stored as numeric(18,2) — source values carry cents
-- (unlike SAP's bigint columns), so numeric avoids lossy rounding.
-- ============================================================

create table management_accounts_uploads (
  id              uuid primary key default uuid_generate_v4(),
  period_month    date not null unique,        -- first-of-month, e.g. 2025-12-01
  period_label    text,                        -- e.g. "December 2025"
  file_name       text not null,
  file_path       text not null,               -- Supabase Storage object path
  file_size       bigint,
  sheet_names     text[] not null default '{}',   -- every sheet found in the workbook
  parsed_sheets   text[] not null default '{}',   -- sheets we successfully parsed
  skipped_sheets  jsonb not null default '{}'::jsonb, -- { sheetName: reason }
  row_counts      jsonb not null default '{}'::jsonb, -- { pnl_lines: 240, ... }
  status          text not null default 'processing', -- processing | success | partial | failed
  error_message   text,
  uploaded_by     uuid references auth.users(id),
  uploaded_at     timestamptz not null default now(),
  parsed_at       timestamptz
);

create index on management_accounts_uploads (period_month desc);

-- ============================================================
-- Profit & Loss — one row per account per month (long format,
-- unpivoted from the sheet's account-rows/month-columns layout).
-- ============================================================
create table pnl_lines (
  id           bigserial primary key,
  upload_id    uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order    int not null,        -- original row index in the sheet, for faithful redisplay
  account_name text not null,
  month        date not null,       -- first-of-month
  amount       numeric(18,2) not null
);

create index on pnl_lines (upload_id);
create index on pnl_lines (account_name, month);

-- ============================================================
-- Cash Flow — same shape as P&L. `section` captures the nearest
-- preceding all-blank marker row (e.g. "CASH INFLOWS" / "CASH OUTFLOWS").
-- ============================================================
create table cashflow_lines (
  id            bigserial primary key,
  upload_id     uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order     int not null,
  section       text,
  category_name text not null,
  month         date not null,
  amount        numeric(18,2) not null
);

create index on cashflow_lines (upload_id);
create index on cashflow_lines (category_name, month);

-- ============================================================
-- Aged Debtors — one row per customer per upload (snapshot as-at
-- the period, not a monthly series).
-- ============================================================
create table aged_debtors_snapshots (
  id              bigserial primary key,
  upload_id       uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order       int not null,
  customer_code   text,
  customer_name   text not null,
  bucket_0_30     numeric(18,2) not null default 0,
  bucket_31_60    numeric(18,2) not null default 0,
  bucket_61_90    numeric(18,2) not null default 0,
  bucket_91_120   numeric(18,2) not null default 0,
  bucket_121_plus numeric(18,2) not null default 0,
  total_kes       numeric(18,2) not null default 0
);

create index on aged_debtors_snapshots (upload_id);
create index on aged_debtors_snapshots (customer_code);

-- ============================================================
-- Aged Creditors — transaction-level, one row per open vendor doc.
-- ============================================================
create table aged_creditors_snapshots (
  id            bigserial primary key,
  upload_id     uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order     int not null,
  vendor_code   text,
  vendor_name   text not null,
  doc_type      text,
  doc_no        text,
  posting_date  date,
  due_date      date,
  bp_ref_no     text,
  balance_due   numeric(18,2) not null default 0
);

create index on aged_creditors_snapshots (upload_id);
create index on aged_creditors_snapshots (vendor_code);

-- ============================================================
-- Stock Levels — named mgmt_stock_snapshots to avoid colliding
-- with the existing SAP-sourced `stock_snapshots` table (live OITW).
-- ============================================================
create table mgmt_stock_snapshots (
  id                bigserial primary key,
  upload_id         uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order         int not null,
  item_no           text not null,
  description       text,
  cumulative_qty    numeric(18,4) not null default 0,
  cumulative_value  numeric(18,2) not null default 0
);

create index on mgmt_stock_snapshots (upload_id);
create index on mgmt_stock_snapshots (item_no);

-- ============================================================
-- Loan Facilities
-- ============================================================
create table loan_facilities (
  id            bigserial primary key,
  upload_id     uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order     int not null,
  facility_name text not null,
  amount        numeric(18,2) not null default 0
);

create index on loan_facilities (upload_id);

-- ============================================================
-- Directors Account — transaction-level ledger entries.
-- ============================================================
create table directors_account_entries (
  id             bigserial primary key,
  upload_id      uuid not null references management_accounts_uploads(id) on delete cascade,
  row_order      int not null,
  posting_date   date,
  trans_no       bigint,
  origin         text,
  origin_no      bigint,
  offset_account text,
  details        text,
  amount_lc      numeric(18,2)
);

create index on directors_account_entries (upload_id);
create index on directors_account_entries (posting_date);

-- ============================================================
-- Storage bucket for the original uploaded workbooks
-- ============================================================
insert into storage.buckets (id, name, public)
values ('management-accounts', 'management-accounts', false)
on conflict (id) do nothing;
