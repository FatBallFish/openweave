CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_dir TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  last_opened_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at_ms
  ON workspaces (updated_at_ms DESC);
