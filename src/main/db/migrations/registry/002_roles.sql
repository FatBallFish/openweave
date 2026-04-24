CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0078d4',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_updated_at_ms ON roles (updated_at_ms DESC);
