-- 006_job_assignments.sql

CREATE TABLE IF NOT EXISTS job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  role TEXT NOT NULL,  -- e.g. fabricator, installer, powdercoat, qc
  assigned_at TIMESTAMP DEFAULT now(),
  unassigned_at TIMESTAMP
);

-- A job can’t have the same employee assigned twice for the same role
CREATE UNIQUE INDEX IF NOT EXISTS uniq_job_employee_role
ON job_assignments (job_id, employee_id, role);
