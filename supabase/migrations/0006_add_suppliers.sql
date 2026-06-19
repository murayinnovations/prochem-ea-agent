CREATE TABLE IF NOT EXISTS suppliers (
  card_code text PRIMARY KEY,
  card_name text,
  card_type text,
  country text,
  currency text,
  balance numeric NOT NULL DEFAULT 0,
  valid boolean DEFAULT true,
  sap_create_date timestamptz,
  sap_update_date timestamptz,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_balance ON suppliers(balance DESC);
