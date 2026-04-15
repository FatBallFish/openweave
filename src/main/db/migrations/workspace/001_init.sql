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
