-- 004_attachments.sql

-- Create attachments table if it doesn’t exist
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- e.g. pdf, image, cut_sheet, nesting
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  uploaded_at TIMESTAMP DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_attachments_job_id ON attachments(job_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
