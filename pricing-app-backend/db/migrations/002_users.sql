-- db/migrations/002_users.sql

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin','office','shop')) NOT NULL DEFAULT 'shop',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
