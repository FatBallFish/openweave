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

CREATE TABLE IF NOT EXISTS workspace_branch_links (
  workspace_id TEXT PRIMARY KEY,
  source_workspace_id TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  source_root_dir TEXT NOT NULL,
  target_root_dir TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_branch_links_source_workspace_id
  ON workspace_branch_links (source_workspace_id);
