ALTER TABLE invoices ADD COLUMN IF NOT EXISTS slp_code integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS slp_name text;
CREATE INDEX IF NOT EXISTS idx_invoices_slp_code ON invoices(slp_code);
