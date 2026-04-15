import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import {
  canvasStateSchema,
  type CanvasNodeInput,
  type CanvasStateInput,
  type FileTreeNodeInput,
  type NoteNodeInput,
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

export interface NoteNodeDraft extends NoteNodeInput {}
export interface TerminalNodeDraft extends TerminalNodeInput {}
export interface FileTreeNodeDraft extends FileTreeNodeInput {}

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

  throw new Error(`Unsupported canvas node type: ${row.node_type}`);
};

const serializeCanvasNode = (node: CanvasNodeInput):
  | ReturnType<typeof serializeNoteNode>
  | ReturnType<typeof serializeTerminalNode>
  | ReturnType<typeof serializeFileTreeNode> => {
  if (node.type === 'note') {
    return serializeNoteNode(node);
  }
  if (node.type === 'file-tree') {
    return {
      ...serializeFileTreeNode(node)
    };
  }
  return {
    ...serializeTerminalNode(node)
  };
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

export interface WorkspaceRepository {
  loadCanvasState: () => CanvasStateInput;
  saveCanvasState: (state: CanvasStateInput) => CanvasStateInput;
  close: () => void;
}

export const createWorkspaceRepository = (options: WorkspaceRepositoryOptions): WorkspaceRepository => {
  const now = options.now ?? (() => Date.now());
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

  fs.mkdirSync(path.dirname(options.dbFilePath), { recursive: true });
  const db: NodeDatabaseSync = new DatabaseSync(options.dbFilePath);
  db.exec(readMigrationSql());

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
    close: (): void => {
      db.close();
    }
  };
};
