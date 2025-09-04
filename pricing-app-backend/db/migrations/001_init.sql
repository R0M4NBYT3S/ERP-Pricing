-- db/migrations/001_init.sql

-- Custom ENUM for job status pipeline
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM (
      'order_received',
      'priced',
      'cut_sheet_generated',
      'cnc_nesting',
      'sent_to_shop',
      'cnc_cutting',
      'fold',
      'assembly',
      'powdercoat',
      'storage',
      'delivery_scheduled',
      'delivered'
    );
  END IF;
END$$;

-- Main jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    po_number TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    product_type TEXT NOT NULL,
    metal_type TEXT,
    delivery_or_install TEXT CHECK (delivery_or_install IN ('delivery', 'install', 'pickup')),

    price NUMERIC(12,2),
    cut_sheet_url TEXT,
    nesting_file_url TEXT,

    status job_status NOT NULL DEFAULT 'order_received',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    closed_at TIMESTAMP
);

-- History table
CREATE TABLE IF NOT EXISTS job_history (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    from_status job_status,
    to_status job_status NOT NULL,
    user_id UUID,
    notes TEXT,
    changed_at TIMESTAMP DEFAULT now()
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT,
    uploaded_by UUID,
    uploaded_at TIMESTAMP DEFAULT now()
);

-- Employees table (optional, but useful for accountability)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT CHECK (role IN ('office','shop','field','admin')),
    created_at TIMESTAMP DEFAULT now()
);
