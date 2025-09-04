CREATE INDEX IF NOT EXISTS idx_jobs_customer_name ON jobs(customer_name);
CREATE INDEX IF NOT EXISTS idx_jobs_po_number ON jobs(po_number);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
