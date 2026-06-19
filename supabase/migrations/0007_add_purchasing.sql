CREATE TABLE IF NOT EXISTS ap_invoices (
  doc_entry integer PRIMARY KEY,
  doc_num integer,
  card_code text,
  doc_date date,
  doc_due_date date,
  doc_total numeric,
  doc_currency text,
  doc_rate numeric,
  paid_to_date numeric,
  doc_status text,
  cancelled boolean DEFAULT false,
  sap_create_date timestamptz,
  sap_update_date timestamptz,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_date ON ap_invoices(doc_date);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_card ON ap_invoices(card_code);

CREATE TABLE IF NOT EXISTS purchase_orders (
  doc_entry integer PRIMARY KEY,
  doc_num integer,
  card_code text,
  doc_date date,
  doc_due_date date,
  doc_total numeric,
  doc_currency text,
  doc_status text,
  cancelled boolean DEFAULT false,
  sap_create_date timestamptz,
  sap_update_date timestamptz,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(doc_date);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  doc_entry integer,
  line_num integer,
  item_code text,
  quantity numeric,
  open_quantity numeric,
  price numeric,
  line_total numeric,
  PRIMARY KEY (doc_entry, line_num)
);
