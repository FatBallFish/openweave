import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import type { RunRecord } from '../../shared/ipc/contracts';
import {
  canvasStateSchema,
  runRuntimeSchema,
  runStatusSchema,
  workspaceIdSchema,
  type CanvasNodeInput,
  type CanvasStateInput,
  type FileTreeNodeInput,
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

interface RunRow {
  id: string;
  workspace_id: string;
  node_id: string;
  runtime: string;
  command: string;
  status: string;
  summary: string | null;
  tail_log: string;
  created_at_ms: number;
  started_at_ms: number | null;
  completed_at_ms: number | null;
  updated_at_ms: number;
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
  created_at_ms = excluded.created_at_ms,
  started_at_ms = excluded.started_at_ms,
  completed_at_ms = excluded.completed_at_ms,
  updated_at_ms = excluded.updated_at_ms
`;

const deleteRunsByWorkspaceSql = `
DELETE FROM runs
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

const parseTerminalPayload = (payloadJson: string): { command: string } => {
  try {
    const parsed = JSON.parse(payloadJson) as { command?: unknown };
    return {
      command: typeof parsed.command === 'string' ? parsed.command : ''
    };
  } catch {
    return { command: '' };
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
    payload_json: JSON.stringify({ command: node.command })
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
      command: payload.command
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

export interface WorkspaceRepository {
  loadCanvasState: () => CanvasStateInput;
  saveCanvasState: (state: CanvasStateInput) => CanvasStateInput;
  saveRun: (run: RunRecord) => RunRecord;
  getRun: (runId: string) => RunRecord | null;
  listRuns: () => RunRecord[];
  listRunsByNode: (nodeId: string) => RunRecord[];
  listRunsByStatus: (status: RunStatusInput) => RunRecord[];
  deleteWorkspaceRuns: (workspaceId: string) => void;
  deleteWorkspaceAuditLogs: (workspaceId: string) => void;
  appendAuditLog: (input: CreateAuditLogInput) => AuditLogRecord;
  listAuditLogs: (limit?: number) => AuditLogRecord[];
  close: () => void;
}

const parseRunStatus = (status: string): RunStatusInput => {
  return runStatusSchema.parse(status);
};

const parseRunRuntime = (runtime: string): RunRuntimeInput => {
  return runRuntimeSchema.parse(runtime);
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

export const createWorkspaceRepository = (options: WorkspaceRepositoryOptions): WorkspaceRepository => {
  const now = options.now ?? (() => Date.now());
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

  fs.mkdirSync(path.dirname(options.dbFilePath), { recursive: true });
  const db: NodeDatabaseSync = new DatabaseSync(options.dbFilePath);
  db.exec(readMigrationSql());
  db.exec(fallbackRunAndAuditSql);

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
    saveRun: (run: RunRecord): RunRecord => {
      const parsedWorkspaceId = workspaceIdSchema.parse(run.workspaceId);
      const parsedStatus = runStatusSchema.parse(run.status);
      const parsedRuntime = runRuntimeSchema.parse(run.runtime);
      const timestamp = now();

      db.prepare(upsertRunSql).run({
        id: run.id,
        workspace_id: parsedWorkspaceId,
        node_id: run.nodeId,
        runtime: parsedRuntime,
        command: run.command,
        status: parsedStatus,
        summary: run.summary,
        tail_log: run.tailLog,
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
    close: (): void => {
      db.close();
    }
  };
};
