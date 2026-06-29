-- invoice_lines currently has only an item_code index.
-- Date-range scans (fast-moving SKUs, volume trend) do a full-table scan without this.
-- Composite (doc_date, item_code) covers both the broad date range scan and the
-- narrower per-SKU trend query (item_code = ? AND doc_date >= ?).
CREATE INDEX IF NOT EXISTS idx_invoice_lines_doc_date
  ON invoice_lines (doc_date);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_date
  ON invoice_lines (item_code, doc_date);
