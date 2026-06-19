CREATE TABLE IF NOT EXISTS stock_snapshots (
  id bigserial PRIMARY KEY,
  snapshot_at timestamptz NOT NULL,
  item_code text NOT NULL,
  whs_code text NOT NULL,
  whs_name text,
  on_hand numeric NOT NULL DEFAULT 0,
  committed numeric NOT NULL DEFAULT 0,
  on_order numeric NOT NULL DEFAULT 0,
  available numeric NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_item ON stock_snapshots(item_code, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_time ON stock_snapshots(snapshot_at);
