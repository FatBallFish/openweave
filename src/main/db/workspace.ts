import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import type { RunRecord } from '../../shared/ipc/contracts';
import {
  canvasStateSchema,
  componentCapabilitySchema,
  graphSnapshotSchemaV2,
  runOutputOffsetSchema,
  runRuntimeSchema,
  runStatusSchema,
  workspaceIdSchema,
  type CanvasNodeInput,
  type CanvasStateInput,
  type FileTreeNodeInput,
  type GraphSnapshotV2Input,
  type NoteNodeInput,
  type PortalNodeInput,
  type RunRuntimeInput,
  type RunStatusInput,
  type TerminalNodeInput
} from '../../shared/ipc/schemas';

interface CanvasNodeRow {
  id: string;
  node_type: string;
  x: number;
  y: number;
  payload_json: string;
}

interface CanvasEdgeRow {
  id: string;
  source_node_id: string;
  target_node_id: string;
}

interface GraphNodeRow {
  id: string;
  component_type: string;
  component_version: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config_json: string;
  state_json: string;
  capabilities_json: string;
  created_at_ms: number;
  updated_at_ms: number;
}

interface GraphEdgeRow {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
  label: string | null;
  meta_json: string;
  created_at_ms: number;
  updated_at_ms: number;
}

interface RunRow {
  id: string;
  workspace_id: string;
  node_id: string;
  runtime: string;
  command: string;
  status: string;
  summary: string | null;
  tail_log: string;
  tail_start_offset: number;
  tail_end_offset: number;
  created_at_ms: number;
  started_at_ms: number | null;
  completed_at_ms: number | null;
  updated_at_ms: number;
}

interface TerminalDispatchRow {
  id: string;
  workspace_id: string;
  target_node_id: string;
  action: string;
  input_text: string;
  created_at_ms: number;
  delivered_at_ms: number | null;
  delivered_run_id: string | null;
}

interface AuditLogRow {
  id: string;
  workspace_id: string;
  event_type: string;
  run_id: string | null;
  status: string;
  message: string;
  created_at_ms: number;
}

interface WorkspaceSkillInjectionRow {
  workspace_id: string;
  runtime_kind: string;
  checksum: string;
  managed_files_json: string;
  created_at_ms: number;
  updated_at_ms: number;
}

const fallbackMigrationSql = `
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
`;

const fallbackRunAndAuditSql = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  runtime TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  tail_log TEXT NOT NULL,
  tail_start_offset INTEGER NOT NULL DEFAULT 0,
  tail_end_offset INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  started_at_ms INTEGER,
  completed_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_workspace_id_created_at_ms
  ON runs (workspace_id, created_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_runs_node_id_created_at_ms
  ON runs (node_id, created_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_runs_status_updated_at_ms
  ON runs (status, updated_at_ms DESC);

CREATE TABLE IF NOT EXISTS terminal_dispatches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  action TEXT NOT NULL,
  input_text TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  delivered_at_ms INTEGER,
  delivered_run_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_terminal_dispatches_target_pending
  ON terminal_dispatches (target_node_id, delivered_at_ms, created_at_ms ASC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  run_id TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id_created_at_ms
  ON audit_logs (workspace_id, created_at_ms DESC);
`;

const selectNodesSql = `
SELECT id, node_type, x, y, payload_json
FROM canvas_nodes
ORDER BY updated_at_ms ASC, created_at_ms ASC
`;

const selectEdgesSql = `
SELECT id, source_node_id, target_node_id
FROM canvas_edges
ORDER BY updated_at_ms ASC, created_at_ms ASC
`;

const insertNodeSql = `
INSERT INTO canvas_nodes (id, node_type, x, y, payload_json, created_at_ms, updated_at_ms)
VALUES (@id, @node_type, @x, @y, @payload_json, @created_at_ms, @updated_at_ms)
`;

const insertEdgeSql = `
INSERT INTO canvas_edges (id, source_node_id, target_node_id, created_at_ms, updated_at_ms)
VALUES (@id, @source_node_id, @target_node_id, @created_at_ms, @updated_at_ms)
`;

const deleteAllNodesSql = `
DELETE FROM canvas_nodes
`;

const deleteAllEdgesSql = `
DELETE FROM canvas_edges
`;

const selectGraphNodesSql = `
SELECT
  id,
  component_type,
  component_version,
  title,
  x,
  y,
  width,
  height,
  config_json,
  state_json,
  capabilities_json,
  created_at_ms,
  updated_at_ms
FROM graph_nodes
ORDER BY updated_at_ms ASC, created_at_ms ASC
`;

const selectGraphEdgesSql = `
SELECT
  id,
  source_node_id,
  target_node_id,
  source_handle,
  target_handle,
  label,
  meta_json,
  created_at_ms,
  updated_at_ms
FROM graph_edges
ORDER BY updated_at_ms ASC, created_at_ms ASC
`;

const insertGraphNodeSql = `
INSERT INTO graph_nodes (
  id,
  component_type,
  component_version,
  title,
  x,
  y,
  width,
  height,
  config_json,
  state_json,
  capabilities_json,
  created_at_ms,
  updated_at_ms
)
VALUES (
  @id,
  @component_type,
  @component_version,
  @title,
  @x,
  @y,
  @width,
  @height,
  @config_json,
  @state_json,
  @capabilities_json,
  @created_at_ms,
  @updated_at_ms
)
`;

const insertGraphEdgeSql = `
INSERT INTO graph_edges (
  id,
  source_node_id,
  target_node_id,
  source_handle,
  target_handle,
  label,
  meta_json,
  created_at_ms,
  updated_at_ms
)
VALUES (
  @id,
  @source_node_id,
  @target_node_id,
  @source_handle,
  @target_handle,
  @label,
  @meta_json,
  @created_at_ms,
  @updated_at_ms
)
`;

const deleteAllGraphNodesSql = `
DELETE FROM graph_nodes
`;

const deleteAllGraphEdgesSql = `
DELETE FROM graph_edges
`;

const selectRunByIdSql = `
SELECT
  id,
  workspace_id,
  node_id,
  runtime,
  command,
  status,
  summary,
  tail_log,
  tail_start_offset,
  tail_end_offset,
  created_at_ms,
  started_at_ms,
  completed_at_ms,
  updated_at_ms
FROM runs
WHERE id = @id
`;

const selectRunsByNodeSql = `
SELECT
  id,
  workspace_id,
  node_id,
  runtime,
  command,
  status,
  summary,
  tail_log,
  tail_start_offset,
  tail_end_offset,
  created_at_ms,
  started_at_ms,
  completed_at_ms,
  updated_at_ms
FROM runs
WHERE node_id = @node_id
ORDER BY created_at_ms DESC
`;

const selectRunsSql = `
SELECT
  id,
  workspace_id,
  node_id,
  runtime,
  command,
  status,
  summary,
  tail_log,
  tail_start_offset,
  tail_end_offset,
  created_at_ms,
  started_at_ms,
  completed_at_ms,
  updated_at_ms
FROM runs
ORDER BY created_at_ms DESC
`;

const selectRunsByStatusSql = `
SELECT
  id,
  workspace_id,
  node_id,
  runtime,
  command,
  status,
  summary,
  tail_log,
  tail_start_offset,
  tail_end_offset,
  created_at_ms,
  started_at_ms,
  completed_at_ms,
  updated_at_ms
FROM runs
WHERE status = @status
ORDER BY updated_at_ms DESC, created_at_ms DESC
`;

const upsertRunSql = `
INSERT INTO runs (
  id,
  workspace_id,
  node_id,
  runtime,
  command,
  status,
  summary,
  tail_log,
  tail_start_offset,
  tail_end_offset,
  created_at_ms,
  started_at_ms,
  completed_at_ms,
  updated_at_ms
)
VALUES (
  @id,
  @workspace_id,
  @node_id,
  @runtime,
  @command,
  @status,
  @summary,
  @tail_log,
  @tail_start_offset,
  @tail_end_offset,
  @created_at_ms,
  @started_at_ms,
  @completed_at_ms,
  @updated_at_ms
)
ON CONFLICT(id) DO UPDATE SET
  workspace_id = excluded.workspace_id,
  node_id = excluded.node_id,
  runtime = excluded.runtime,
  command = excluded.command,
  status = excluded.status,
  summary = excluded.summary,
  tail_log = excluded.tail_log,
  tail_start_offset = excluded.tail_start_offset,
  tail_end_offset = excluded.tail_end_offset,
  created_at_ms = excluded.created_at_ms,
  started_at_ms = excluded.started_at_ms,
  completed_at_ms = excluded.completed_at_ms,
  updated_at_ms = excluded.updated_at_ms
`;

const deleteRunsByWorkspaceSql = `
DELETE FROM runs
WHERE workspace_id = @workspace_id
`;

const insertTerminalDispatchSql = `
INSERT INTO terminal_dispatches (
  id,
  workspace_id,
  target_node_id,
  action,
  input_text,
  created_at_ms,
  delivered_at_ms,
  delivered_run_id
)
VALUES (
  @id,
  @workspace_id,
  @target_node_id,
  @action,
  @input_text,
  @created_at_ms,
  @delivered_at_ms,
  @delivered_run_id
)
`;

const selectPendingTerminalDispatchesByNodeSql = `
SELECT
  id,
  workspace_id,
  target_node_id,
  action,
  input_text,
  created_at_ms,
  delivered_at_ms,
  delivered_run_id
FROM terminal_dispatches
WHERE target_node_id = @target_node_id
  AND delivered_at_ms IS NULL
ORDER BY created_at_ms ASC
LIMIT @limit
`;

const markTerminalDispatchDeliveredSql = `
UPDATE terminal_dispatches
SET delivered_at_ms = @delivered_at_ms,
    delivered_run_id = @delivered_run_id
WHERE id = @id
`;

const deleteTerminalDispatchesByWorkspaceSql = `
DELETE FROM terminal_dispatches
WHERE workspace_id = @workspace_id
`;

const deleteAuditLogsByWorkspaceSql = `
DELETE FROM audit_logs
WHERE workspace_id = @workspace_id
`;

const insertAuditLogSql = `
INSERT INTO audit_logs (
  id,
  workspace_id,
  event_type,
  run_id,
  status,
  message,
  created_at_ms
)
VALUES (
  @id,
  @workspace_id,
  @event_type,
  @run_id,
  @status,
  @message,
  @created_at_ms
)
`;

const selectAuditLogsSql = `
SELECT
  id,
  workspace_id,
  event_type,
  run_id,
  status,
  message,
  created_at_ms
FROM audit_logs
ORDER BY created_at_ms DESC
LIMIT @limit
`;

const selectSkillInjectionByRuntimeSql = `
SELECT
  workspace_id,
  runtime_kind,
  checksum,
  managed_files_json,
  created_at_ms,
  updated_at_ms
FROM workspace_skill_injections
WHERE runtime_kind = @runtime_kind
`;

const selectSkillInjectionsSql = `
SELECT
  workspace_id,
  runtime_kind,
  checksum,
  managed_files_json,
  created_at_ms,
  updated_at_ms
FROM workspace_skill_injections
ORDER BY runtime_kind ASC
`;

const upsertSkillInjectionSql = `
INSERT INTO workspace_skill_injections (
  workspace_id,
  runtime_kind,
  checksum,
  managed_files_json,
  created_at_ms,
  updated_at_ms
)
VALUES (
  @workspace_id,
  @runtime_kind,
  @checksum,
  @managed_files_json,
  @created_at_ms,
  @updated_at_ms
)
ON CONFLICT(workspace_id, runtime_kind) DO UPDATE SET
  checksum = excluded.checksum,
  managed_files_json = excluded.managed_files_json,
  created_at_ms = excluded.created_at_ms,
  updated_at_ms = excluded.updated_at_ms
`;

const deleteSkillInjectionSql = `
DELETE FROM workspace_skill_injections
WHERE runtime_kind = @runtime_kind
`;

const readMigrationSql = (): string => {
  const candidates = [
    path.resolve(__dirname, 'migrations/workspace/001_init.sql'),
    path.resolve(process.cwd(), 'src/main/db/migrations/workspace/001_init.sql')
  ];

  for (const migrationPath of candidates) {
    if (fs.existsSync(migrationPath)) {
      return fs.readFileSync(migrationPath, 'utf8');
    }
  }

  return fallbackMigrationSql;
};

const DATABASE_BUSY_TIMEOUT_MS = 5000;

const hasRowsRequiringTailEndOffsetBackfill = (db: NodeDatabaseSync): boolean => {
  const row = db
    .prepare(
      `
        SELECT 1
        FROM runs
        WHERE tail_end_offset IS NULL OR tail_end_offset < LENGTH(tail_log)
        LIMIT 1
      `
    )
    .get() as { 1: number } | undefined;

  return Boolean(row);
};

const hasRowsRequiringTailStartOffsetBackfill = (db: NodeDatabaseSync): boolean => {
  const row = db
    .prepare(
      `
        SELECT 1
        FROM runs
        WHERE tail_start_offset IS NULL
          OR tail_start_offset < 0
          OR tail_start_offset > tail_end_offset
          OR (tail_end_offset - tail_start_offset) != LENGTH(tail_log)
        LIMIT 1
      `
    )
    .get() as { 1: number } | undefined;

  return Boolean(row);
};

const ensureRunOffsetColumns = (db: NodeDatabaseSync): void => {
  const columns = db.prepare('PRAGMA table_info(runs)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('tail_start_offset')) {
    db.exec('ALTER TABLE runs ADD COLUMN tail_start_offset INTEGER NOT NULL DEFAULT 0');
  }

  if (!columnNames.has('tail_end_offset')) {
    db.exec('ALTER TABLE runs ADD COLUMN tail_end_offset INTEGER NOT NULL DEFAULT 0');
  }

  if (hasRowsRequiringTailEndOffsetBackfill(db)) {
    db.exec(`
      UPDATE runs
      SET tail_end_offset = CASE
        WHEN tail_end_offset IS NULL OR tail_end_offset < LENGTH(tail_log) THEN LENGTH(tail_log)
        ELSE tail_end_offset
      END
    `);
  }

  if (hasRowsRequiringTailStartOffsetBackfill(db)) {
    db.exec(`
      UPDATE runs
      SET tail_start_offset = max(0, tail_end_offset - LENGTH(tail_log))
      WHERE tail_start_offset IS NULL
        OR tail_start_offset < 0
        OR tail_start_offset > tail_end_offset
        OR (tail_end_offset - tail_start_offset) != LENGTH(tail_log)
    `);
  }
};

const parseNotePayload = (payloadJson: string): { contentMd: string } => {
  try {
    const parsed = JSON.parse(payloadJson) as { contentMd?: unknown };
    return {
      contentMd: typeof parsed.contentMd === 'string' ? parsed.contentMd : ''
    };
  } catch {
    return { contentMd: '' };
  }
};

const parseTerminalPayload = (payloadJson: string): { command: string; runtime: RunRuntimeInput } => {
  try {
    const parsed = JSON.parse(payloadJson) as { command?: unknown; runtime?: unknown };
    return {
      command: typeof parsed.command === 'string' ? parsed.command : '',
      runtime: runRuntimeSchema.catch('shell').parse(parsed.runtime)
    };
  } catch {
    return { command: '', runtime: 'shell' };
  }
};

const parseFileTreePayload = (payloadJson: string): { rootDir: string } => {
  try {
    const parsed = JSON.parse(payloadJson) as { rootDir?: unknown };
    return {
      rootDir: typeof parsed.rootDir === 'string' ? parsed.rootDir : ''
    };
  } catch {
    return { rootDir: '' };
  }
};

const parsePortalPayload = (payloadJson: string): { url: string } => {
  try {
    const parsed = JSON.parse(payloadJson) as { url?: unknown };
    return {
      url: typeof parsed.url === 'string' ? parsed.url : ''
    };
  } catch {
    return { url: '' };
  }
};

const parseJsonRecord = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
};

const parseCapabilities = (value: string): Array<ReturnType<typeof componentCapabilitySchema.parse>> => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => componentCapabilitySchema.parse(item));
  } catch {
    return [];
  }
};

export interface NoteNodeDraft extends NoteNodeInput {}
export interface TerminalNodeDraft extends TerminalNodeInput {}
export interface FileTreeNodeDraft extends FileTreeNodeInput {}
export interface PortalNodeDraft extends PortalNodeInput {}

export const serializeNoteNode = (node: NoteNodeDraft): {
  id: string;
  node_type: 'note';
  x: number;
  y: number;
  payload_json: string;
} => {
  return {
    id: node.id,
    node_type: 'note',
    x: node.x,
    y: node.y,
    payload_json: JSON.stringify({ contentMd: node.contentMd })
  };
};

export const serializeTerminalNode = (node: TerminalNodeDraft): {
  id: string;
  node_type: 'terminal';
  x: number;
  y: number;
  payload_json: string;
} => {
  return {
    id: node.id,
    node_type: 'terminal',
    x: node.x,
    y: node.y,
    payload_json: JSON.stringify({ command: node.command, runtime: node.runtime })
  };
};

export const serializeFileTreeNode = (node: FileTreeNodeDraft): {
  id: string;
  node_type: 'file-tree';
  x: number;
  y: number;
  payload_json: string;
} => {
  return {
    id: node.id,
    node_type: 'file-tree',
    x: node.x,
    y: node.y,
    payload_json: JSON.stringify({ rootDir: node.rootDir })
  };
};

export const serializePortalNode = (node: PortalNodeDraft): {
  id: string;
  node_type: 'portal';
  x: number;
  y: number;
  payload_json: string;
} => {
  return {
    id: node.id,
    node_type: 'portal',
    x: node.x,
    y: node.y,
    payload_json: JSON.stringify({ url: node.url })
  };
};

const mapNodeRow = (row: CanvasNodeRow): CanvasNodeInput => {
  if (row.node_type === 'note') {
    const payload = parseNotePayload(row.payload_json);
    return {
      id: row.id,
      type: 'note',
      x: row.x,
      y: row.y,
      contentMd: payload.contentMd
    };
  }

  if (row.node_type === 'terminal') {
    const payload = parseTerminalPayload(row.payload_json);
    return {
      id: row.id,
      type: 'terminal',
      x: row.x,
      y: row.y,
      command: payload.command,
      runtime: payload.runtime
    };
  }

  if (row.node_type === 'file-tree') {
    const payload = parseFileTreePayload(row.payload_json);
    return {
      id: row.id,
      type: 'file-tree',
      x: row.x,
      y: row.y,
      rootDir: payload.rootDir
    };
  }

  if (row.node_type === 'portal') {
    const payload = parsePortalPayload(row.payload_json);
    return {
      id: row.id,
      type: 'portal',
      x: row.x,
      y: row.y,
      url: payload.url
    };
  }

  throw new Error(`Unsupported canvas node type: ${row.node_type}`);
};

const serializeCanvasNode = (node: CanvasNodeInput):
  | ReturnType<typeof serializeNoteNode>
  | ReturnType<typeof serializeTerminalNode>
  | ReturnType<typeof serializeFileTreeNode>
  | ReturnType<typeof serializePortalNode> => {
  if (node.type === 'note') {
    return serializeNoteNode(node);
  }
  if (node.type === 'terminal') {
    return {
      ...serializeTerminalNode(node)
    };
  }
  if (node.type === 'file-tree') {
    return {
      ...serializeFileTreeNode(node)
    };
  }
  if (node.type === 'portal') {
    return {
      ...serializePortalNode(node)
    };
  }
  throw new Error(`Unsupported canvas node type: ${(node as { type?: string }).type ?? 'unknown'}`);
};

const mapEdgeRow = (row: CanvasEdgeRow): CanvasStateInput['edges'][number] => {
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id
  };
};

const mapGraphNodeRow = (row: GraphNodeRow): GraphSnapshotV2Input['nodes'][number] => {
  return {
    id: row.id,
    componentType: row.component_type,
    componentVersion: row.component_version,
    title: row.title,
    bounds: {
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height
    },
    config: parseJsonRecord(row.config_json),
    state: parseJsonRecord(row.state_json),
    capabilities: parseCapabilities(row.capabilities_json),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  };
};

const mapGraphEdgeRow = (row: GraphEdgeRow): GraphSnapshotV2Input['edges'][number] => {
  return {
    id: row.id,
    source: row.source_node_id,
    target: row.target_node_id,
    sourceHandle: row.source_handle,
    targetHandle: row.target_handle,
    label: row.label,
    meta: parseJsonRecord(row.meta_json),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  };
};

const sanitizeCanvasState = (state: CanvasStateInput): CanvasStateInput => {
  const nodeIds = new Set<string>(state.nodes.map((node) => node.id));
  return {
    nodes: state.nodes,
    edges: state.edges.filter(
      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
    )
  };
};

export interface WorkspaceRepositoryOptions {
  dbFilePath: string;
  now?: () => number;
}

export type AuditLogStatus = 'success' | 'failed';
export type WorkspaceSkillInjectionRuntimeKind = 'codex' | 'claude' | 'opencode';

export interface WorkspaceSkillManagedFileRecord {
  relativePath: string;
  contentChecksum: string;
}

export interface WorkspaceSkillInjectionRecord {
  workspaceId: string;
  runtimeKind: WorkspaceSkillInjectionRuntimeKind;
  checksum: string;
  managedFiles: WorkspaceSkillManagedFileRecord[];
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SaveWorkspaceSkillInjectionInput {
  workspaceId: string;
  runtimeKind: WorkspaceSkillInjectionRuntimeKind;
  checksum: string;
  managedFiles: WorkspaceSkillManagedFileRecord[];
  createdAtMs: number;
  updatedAtMs: number;
}

export interface WorkspaceSkillInjectionStore {
  getSkillInjection: (runtimeKind: WorkspaceSkillInjectionRuntimeKind) => WorkspaceSkillInjectionRecord | null;
  listSkillInjections: () => WorkspaceSkillInjectionRecord[];
  saveSkillInjection: (input: SaveWorkspaceSkillInjectionInput) => WorkspaceSkillInjectionRecord;
  deleteSkillInjection: (runtimeKind: WorkspaceSkillInjectionRuntimeKind) => void;
}

export interface AuditLogRecord {
  id: string;
  workspaceId: string;
  eventType: string;
  runId: string | null;
  status: AuditLogStatus;
  message: string;
  createdAtMs: number;
}

export interface CreateAuditLogInput {
  id: string;
  workspaceId: string;
  eventType: string;
  runId?: string | null;
  status: AuditLogStatus;
  message: string;
  createdAtMs?: number;
}

export interface TerminalDispatchRecord {
  id: string;
  workspaceId: string;
  targetNodeId: string;
  action: string;
  inputText: string;
  createdAtMs: number;
  deliveredAtMs: number | null;
  deliveredRunId: string | null;
}

export interface CreateTerminalDispatchInput {
  id: string;
  workspaceId: string;
  targetNodeId: string;
  action: string;
  inputText: string;
  createdAtMs?: number;
}

export interface WorkspaceRepository {
  loadCanvasState: () => CanvasStateInput;
  saveCanvasState: (state: CanvasStateInput) => CanvasStateInput;
  loadGraphSnapshot: () => GraphSnapshotV2Input;
  saveGraphSnapshot: (snapshot: GraphSnapshotV2Input) => GraphSnapshotV2Input;
  saveRun: (run: RunRecord) => RunRecord;
  getRun: (runId: string) => RunRecord | null;
  listRuns: () => RunRecord[];
  listRunsByNode: (nodeId: string) => RunRecord[];
  listRunsByStatus: (status: RunStatusInput) => RunRecord[];
  deleteWorkspaceRuns: (workspaceId: string) => void;
  enqueueTerminalDispatch: (input: CreateTerminalDispatchInput) => TerminalDispatchRecord;
  listPendingTerminalDispatches: (targetNodeId: string, limit?: number) => TerminalDispatchRecord[];
  markTerminalDispatchDelivered: (dispatchId: string, deliveredRunId: string) => void;
  deleteWorkspaceTerminalDispatches: (workspaceId: string) => void;
  deleteWorkspaceAuditLogs: (workspaceId: string) => void;
  appendAuditLog: (input: CreateAuditLogInput) => AuditLogRecord;
  listAuditLogs: (limit?: number) => AuditLogRecord[];
  getSkillInjection: (runtimeKind: WorkspaceSkillInjectionRuntimeKind) => WorkspaceSkillInjectionRecord | null;
  listSkillInjections: () => WorkspaceSkillInjectionRecord[];
  saveSkillInjection: (input: SaveWorkspaceSkillInjectionInput) => WorkspaceSkillInjectionRecord;
  deleteSkillInjection: (runtimeKind: WorkspaceSkillInjectionRuntimeKind) => void;
  close: () => void;
}

const parseRunStatus = (status: string): RunStatusInput => {
  return runStatusSchema.parse(status);
};

const parseRunRuntime = (runtime: string): RunRuntimeInput => {
  return runRuntimeSchema.parse(runtime);
};

const parseRunOutputOffset = (offset: number): number => {
  return runOutputOffsetSchema.parse(offset);
};

const mapRunRow = (row: RunRow): RunRecord => {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    runtime: parseRunRuntime(row.runtime),
    command: row.command,
    status: parseRunStatus(row.status),
    summary: row.summary,
    tailLog: row.tail_log,
    tailStartOffset: parseRunOutputOffset(row.tail_start_offset),
    tailEndOffset: parseRunOutputOffset(row.tail_end_offset),
    createdAtMs: row.created_at_ms,
    startedAtMs: row.started_at_ms,
    completedAtMs: row.completed_at_ms
  };
};

const parseAuditStatus = (status: string): AuditLogStatus => {
  if (status === 'success' || status === 'failed') {
    return status;
  }
  throw new Error(`Unsupported audit log status: ${status}`);
};

const mapAuditLogRow = (row: AuditLogRow): AuditLogRecord => {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    eventType: row.event_type,
    runId: row.run_id,
    status: parseAuditStatus(row.status),
    message: row.message,
    createdAtMs: row.created_at_ms
  };
};

const mapTerminalDispatchRow = (row: TerminalDispatchRow): TerminalDispatchRecord => {
  return {
    id: row.id,
    workspaceId: workspaceIdSchema.parse(row.workspace_id),
    targetNodeId: row.target_node_id,
    action: row.action,
    inputText: row.input_text,
    createdAtMs: row.created_at_ms,
    deliveredAtMs: row.delivered_at_ms,
    deliveredRunId: row.delivered_run_id
  };
};

const toAuditLogLimit = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 200;
  }
  const rounded = Math.floor(value);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 1000) {
    return 1000;
  }
  return rounded;
};

const toTerminalDispatchLimit = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 100;
  }
  const rounded = Math.floor(value);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 1000) {
    return 1000;
  }
  return rounded;
};

const parseWorkspaceSkillInjectionRuntimeKind = (
  runtimeKind: string
): WorkspaceSkillInjectionRuntimeKind => {
  if (runtimeKind === 'codex' || runtimeKind === 'claude' || runtimeKind === 'opencode') {
    return runtimeKind;
  }

  throw new Error(`Unsupported workspace skill injection runtime kind: ${runtimeKind}`);
};

const parseWorkspaceSkillManagedFiles = (value: string): WorkspaceSkillManagedFileRecord[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.relativePath !== 'string' ||
        candidate.relativePath.trim().length === 0 ||
        typeof candidate.contentChecksum !== 'string' ||
        candidate.contentChecksum.trim().length === 0
      ) {
        return [];
      }

      return [
        {
          relativePath: candidate.relativePath,
          contentChecksum: candidate.contentChecksum
        }
      ];
    });
  } catch {
    return [];
  }
};

const mapWorkspaceSkillInjectionRow = (
  row: WorkspaceSkillInjectionRow
): WorkspaceSkillInjectionRecord => {
  return {
    workspaceId: workspaceIdSchema.parse(row.workspace_id),
    runtimeKind: parseWorkspaceSkillInjectionRuntimeKind(row.runtime_kind),
    checksum: row.checksum,
    managedFiles: parseWorkspaceSkillManagedFiles(row.managed_files_json),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  };
};

export const createWorkspaceRepository = (options: WorkspaceRepositoryOptions): WorkspaceRepository => {
  const now = options.now ?? (() => Date.now());
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

  fs.mkdirSync(path.dirname(options.dbFilePath), { recursive: true });
  const db: NodeDatabaseSync = new DatabaseSync(options.dbFilePath);
  db.exec(`PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
  db.exec(readMigrationSql());
  db.exec(fallbackRunAndAuditSql);
  ensureRunOffsetColumns(db);

  const getRunById = (runId: string): RunRecord | null => {
    const row = db.prepare(selectRunByIdSql).get({ id: runId }) as RunRow | undefined;
    if (!row) {
      return null;
    }
    return mapRunRow(row);
  };

  return {
    loadCanvasState: (): CanvasStateInput => {
      const nodeRows = db.prepare(selectNodesSql).all() as unknown as CanvasNodeRow[];
      const edgeRows = db.prepare(selectEdgesSql).all() as unknown as CanvasEdgeRow[];
      const parsed = canvasStateSchema.parse({
        nodes: nodeRows.map(mapNodeRow),
        edges: edgeRows.map(mapEdgeRow)
      });
      return sanitizeCanvasState(parsed);
    },
    saveCanvasState: (state: CanvasStateInput): CanvasStateInput => {
      const parsed = sanitizeCanvasState(canvasStateSchema.parse(state));
      const timestamp = now();

      db.exec('BEGIN');
      try {
        db.prepare(deleteAllEdgesSql).run();
        db.prepare(deleteAllNodesSql).run();

        for (const node of parsed.nodes) {
          const serialized = serializeCanvasNode(node);
          db.prepare(insertNodeSql).run({
            ...serialized,
            created_at_ms: timestamp,
            updated_at_ms: timestamp
          });
        }

        for (const edge of parsed.edges) {
          db.prepare(insertEdgeSql).run({
            id: edge.id,
            source_node_id: edge.sourceNodeId,
            target_node_id: edge.targetNodeId,
            created_at_ms: timestamp,
            updated_at_ms: timestamp
          });
        }

        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      return parsed;
    },
    loadGraphSnapshot: (): GraphSnapshotV2Input => {
      const nodeRows = db.prepare(selectGraphNodesSql).all() as unknown as GraphNodeRow[];
      const edgeRows = db.prepare(selectGraphEdgesSql).all() as unknown as GraphEdgeRow[];
      return graphSnapshotSchemaV2.parse({
        schemaVersion: 2,
        nodes: nodeRows.map(mapGraphNodeRow),
        edges: edgeRows.map(mapGraphEdgeRow)
      });
    },
    saveGraphSnapshot: (snapshot: GraphSnapshotV2Input): GraphSnapshotV2Input => {
      const parsed = graphSnapshotSchemaV2.parse(snapshot);

      db.exec('BEGIN');
      try {
        db.prepare(deleteAllGraphEdgesSql).run();
        db.prepare(deleteAllGraphNodesSql).run();

        for (const node of parsed.nodes) {
          db.prepare(insertGraphNodeSql).run({
            id: node.id,
            component_type: node.componentType,
            component_version: node.componentVersion,
            title: node.title,
            x: node.bounds.x,
            y: node.bounds.y,
            width: node.bounds.width,
            height: node.bounds.height,
            config_json: JSON.stringify(node.config),
            state_json: JSON.stringify(node.state),
            capabilities_json: JSON.stringify(node.capabilities),
            created_at_ms: node.createdAtMs,
            updated_at_ms: node.updatedAtMs
          });
        }

        for (const edge of parsed.edges) {
          db.prepare(insertGraphEdgeSql).run({
            id: edge.id,
            source_node_id: edge.source,
            target_node_id: edge.target,
            source_handle: edge.sourceHandle,
            target_handle: edge.targetHandle,
            label: edge.label,
            meta_json: JSON.stringify(edge.meta ?? {}),
            created_at_ms: edge.createdAtMs,
            updated_at_ms: edge.updatedAtMs
          });
        }

        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      return parsed;
    },
    saveRun: (run: RunRecord): RunRecord => {
      const parsedWorkspaceId = workspaceIdSchema.parse(run.workspaceId);
      const parsedStatus = runStatusSchema.parse(run.status);
      const parsedRuntime = runRuntimeSchema.parse(run.runtime);
      const tailLog = typeof run.tailLog === 'string' ? run.tailLog : '';
      const tailEndOffset = parseRunOutputOffset(
        typeof run.tailEndOffset === 'number' ? run.tailEndOffset : tailLog.length
      );
      const tailStartOffset = parseRunOutputOffset(
        typeof run.tailStartOffset === 'number'
          ? run.tailStartOffset
          : Math.max(0, tailEndOffset - tailLog.length)
      );
      const timestamp = now();

      db.prepare(upsertRunSql).run({
        id: run.id,
        workspace_id: parsedWorkspaceId,
        node_id: run.nodeId,
        runtime: parsedRuntime,
        command: run.command,
        status: parsedStatus,
        summary: run.summary,
        tail_log: tailLog,
        tail_start_offset: tailStartOffset,
        tail_end_offset: tailEndOffset,
        created_at_ms: run.createdAtMs,
        started_at_ms: run.startedAtMs,
        completed_at_ms: run.completedAtMs,
        updated_at_ms: timestamp
      });

      const stored = getRunById(run.id);
      if (!stored) {
        throw new Error(`Run not found after save: ${run.id}`);
      }
      return stored;
    },
    getRun: (runId: string): RunRecord | null => {
      return getRunById(runId);
    },
    listRuns: (): RunRecord[] => {
      const rows = db.prepare(selectRunsSql).all() as unknown as RunRow[];
      return rows.map(mapRunRow);
    },
    listRunsByNode: (nodeId: string): RunRecord[] => {
      const rows = db.prepare(selectRunsByNodeSql).all({ node_id: nodeId }) as unknown as RunRow[];
      return rows.map(mapRunRow);
    },
    listRunsByStatus: (status: RunStatusInput): RunRecord[] => {
      const parsedStatus = runStatusSchema.parse(status);
      const rows = db.prepare(selectRunsByStatusSql).all({ status: parsedStatus }) as unknown as RunRow[];
      return rows.map(mapRunRow);
    },
    deleteWorkspaceRuns: (workspaceId: string): void => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      db.prepare(deleteRunsByWorkspaceSql).run({
        workspace_id: parsedWorkspaceId
      });
    },
    enqueueTerminalDispatch: (input: CreateTerminalDispatchInput): TerminalDispatchRecord => {
      const createdAtMs = input.createdAtMs ?? now();
      const parsedWorkspaceId = workspaceIdSchema.parse(input.workspaceId);

      db.prepare(insertTerminalDispatchSql).run({
        id: input.id,
        workspace_id: parsedWorkspaceId,
        target_node_id: input.targetNodeId,
        action: input.action,
        input_text: input.inputText,
        created_at_ms: createdAtMs,
        delivered_at_ms: null,
        delivered_run_id: null
      });

      return {
        id: input.id,
        workspaceId: parsedWorkspaceId,
        targetNodeId: input.targetNodeId,
        action: input.action,
        inputText: input.inputText,
        createdAtMs,
        deliveredAtMs: null,
        deliveredRunId: null
      };
    },
    listPendingTerminalDispatches: (targetNodeId: string, limit?: number): TerminalDispatchRecord[] => {
      const rows = db.prepare(selectPendingTerminalDispatchesByNodeSql).all({
        target_node_id: targetNodeId,
        limit: toTerminalDispatchLimit(limit)
      }) as unknown as TerminalDispatchRow[];
      return rows.map(mapTerminalDispatchRow);
    },
    markTerminalDispatchDelivered: (dispatchId: string, deliveredRunId: string): void => {
      db.prepare(markTerminalDispatchDeliveredSql).run({
        id: dispatchId,
        delivered_at_ms: now(),
        delivered_run_id: deliveredRunId
      });
    },
    deleteWorkspaceTerminalDispatches: (workspaceId: string): void => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      db.prepare(deleteTerminalDispatchesByWorkspaceSql).run({
        workspace_id: parsedWorkspaceId
      });
    },
    deleteWorkspaceAuditLogs: (workspaceId: string): void => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      db.prepare(deleteAuditLogsByWorkspaceSql).run({
        workspace_id: parsedWorkspaceId
      });
    },
    appendAuditLog: (input: CreateAuditLogInput): AuditLogRecord => {
      const createdAtMs = input.createdAtMs ?? now();
      const parsedWorkspaceId = workspaceIdSchema.parse(input.workspaceId);

      db.prepare(insertAuditLogSql).run({
        id: input.id,
        workspace_id: parsedWorkspaceId,
        event_type: input.eventType,
        run_id: input.runId ?? null,
        status: input.status,
        message: input.message,
        created_at_ms: createdAtMs
      });

      return {
        id: input.id,
        workspaceId: parsedWorkspaceId,
        eventType: input.eventType,
        runId: input.runId ?? null,
        status: input.status,
        message: input.message,
        createdAtMs
      };
    },
    listAuditLogs: (limit?: number): AuditLogRecord[] => {
      const rows = db.prepare(selectAuditLogsSql).all({ limit: toAuditLogLimit(limit) }) as unknown as AuditLogRow[];
      return rows.map(mapAuditLogRow);
    },
    getSkillInjection: (
      runtimeKind: WorkspaceSkillInjectionRuntimeKind
    ): WorkspaceSkillInjectionRecord | null => {
      const row = db.prepare(selectSkillInjectionByRuntimeSql).get({
        runtime_kind: parseWorkspaceSkillInjectionRuntimeKind(runtimeKind)
      }) as WorkspaceSkillInjectionRow | undefined;

      if (!row) {
        return null;
      }

      return mapWorkspaceSkillInjectionRow(row);
    },
    listSkillInjections: (): WorkspaceSkillInjectionRecord[] => {
      const rows = db.prepare(selectSkillInjectionsSql).all() as unknown as WorkspaceSkillInjectionRow[];
      return rows.map(mapWorkspaceSkillInjectionRow);
    },
    saveSkillInjection: (input: SaveWorkspaceSkillInjectionInput): WorkspaceSkillInjectionRecord => {
      const parsedWorkspaceId = workspaceIdSchema.parse(input.workspaceId);
      const runtimeKind = parseWorkspaceSkillInjectionRuntimeKind(input.runtimeKind);

      db.prepare(upsertSkillInjectionSql).run({
        workspace_id: parsedWorkspaceId,
        runtime_kind: runtimeKind,
        checksum: input.checksum,
        managed_files_json: JSON.stringify(input.managedFiles),
        created_at_ms: input.createdAtMs,
        updated_at_ms: input.updatedAtMs
      });

      const stored = db.prepare(selectSkillInjectionByRuntimeSql).get({
        runtime_kind: runtimeKind
      }) as WorkspaceSkillInjectionRow | undefined;

      if (!stored) {
        throw new Error(`Workspace skill injection not found after save: ${runtimeKind}`);
      }

      return mapWorkspaceSkillInjectionRow(stored);
    },
    deleteSkillInjection: (runtimeKind: WorkspaceSkillInjectionRuntimeKind): void => {
      db.prepare(deleteSkillInjectionSql).run({
        runtime_kind: parseWorkspaceSkillInjectionRuntimeKind(runtimeKind)
      });
    },
    close: (): void => {
      db.close();
    }
  };
};
