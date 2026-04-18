CREATE TABLE IF NOT EXISTS canvas_nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  payload_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS canvas_edges (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canvas_nodes_updated_at_ms
  ON canvas_nodes (updated_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_canvas_edges_updated_at_ms
  ON canvas_edges (updated_at_ms DESC);

CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  component_type TEXT NOT NULL,
  component_version TEXT NOT NULL,
  title TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  config_json TEXT NOT NULL,
  state_json TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  source_handle TEXT,
  target_handle TEXT,
  label TEXT,
  meta_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_updated_at_ms
  ON graph_nodes (updated_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_graph_edges_updated_at_ms
  ON graph_edges (updated_at_ms DESC);

CREATE TABLE IF NOT EXISTS workspace_skill_injections (
  workspace_id TEXT NOT NULL,
  runtime_kind TEXT NOT NULL,
  checksum TEXT NOT NULL,
  managed_files_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, runtime_kind)
);

CREATE INDEX IF NOT EXISTS idx_workspace_skill_injections_updated_at_ms
  ON workspace_skill_injections (updated_at_ms DESC);
