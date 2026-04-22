CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_dir TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'folder-stack',
  icon_color TEXT NOT NULL DEFAULT '#64748B',
  group_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  last_opened_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at_ms
  ON workspaces (updated_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_group_sort_order
  ON workspaces (group_id, sort_order);

CREATE TABLE IF NOT EXISTS workspace_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_groups_sort_order
  ON workspace_groups (sort_order);

CREATE TABLE IF NOT EXISTS workspace_group_ui_state (
  group_id TEXT PRIMARY KEY,
  is_collapsed INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES workspace_groups(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS component_packages (
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  package_root TEXT NOT NULL,
  package_checksum TEXT,
  manifest_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL,
  is_installed INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (name, version)
);

CREATE INDEX IF NOT EXISTS idx_component_packages_enabled
  ON component_packages (is_enabled, source_kind, name, version);
