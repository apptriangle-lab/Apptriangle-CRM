-- Per-line VAT for RFQ items (optional manual run).
-- The Flask app also adds this column on startup if missing (see add_rfq_items_vat_percent_column_if_missing in app/__init__.py).
ALTER TABLE rfq_items ADD COLUMN vat_percent FLOAT NULL;
