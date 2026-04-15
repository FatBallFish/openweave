import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import type { WorkspaceRecord } from '../../shared/ipc/contracts';
import { workspaceCreateSchema, workspaceIdSchema, type WorkspaceCreateInput } from '../../shared/ipc/schemas';

interface WorkspaceRow {
  id: string;
  name: string;
  root_dir: string;
  created_at_ms: number;
  updated_at_ms: number;
  last_opened_at_ms: number | null;
}

const fallbackMigrationSql = `
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
`;

const selectWorkspaceByIdSql = `
SELECT id, name, root_dir, created_at_ms, updated_at_ms, last_opened_at_ms
FROM workspaces
WHERE id = @id
`;

const selectWorkspacesSql = `
SELECT id, name, root_dir, created_at_ms, updated_at_ms, last_opened_at_ms
FROM workspaces
ORDER BY updated_at_ms DESC, created_at_ms DESC
`;

const insertWorkspaceSql = `
INSERT INTO workspaces (id, name, root_dir, created_at_ms, updated_at_ms, last_opened_at_ms)
VALUES (@id, @name, @root_dir, @created_at_ms, @updated_at_ms, NULL)
`;

const updateWorkspaceOpenedSql = `
UPDATE workspaces
SET updated_at_ms = @updated_at_ms,
    last_opened_at_ms = @last_opened_at_ms
WHERE id = @id
`;

const deleteWorkspaceSql = `
DELETE FROM workspaces
WHERE id = @id
`;

export interface RegistryRepositoryOptions {
  dbFilePath: string;
  now?: () => number;
  randomId?: () => string;
}

export interface RegistryRepository {
  createWorkspace: (input: WorkspaceCreateInput) => WorkspaceRecord;
  listWorkspaces: () => WorkspaceRecord[];
  getWorkspace: (workspaceId: string) => WorkspaceRecord;
  hasWorkspace: (workspaceId: string) => boolean;
  openWorkspace: (workspaceId: string) => WorkspaceRecord;
  deleteWorkspace: (workspaceId: string) => boolean;
  close: () => void;
}

const mapWorkspaceRow = (row: WorkspaceRow): WorkspaceRecord => {
  return {
    id: row.id,
    name: row.name,
    rootDir: row.root_dir,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
    lastOpenedAtMs: row.last_opened_at_ms
  };
};

const readMigrationSql = (): string => {
  const candidates = [
    path.resolve(__dirname, 'migrations/registry/001_init.sql'),
    path.resolve(process.cwd(), 'src/main/db/migrations/registry/001_init.sql')
  ];

  for (const migrationPath of candidates) {
    if (fs.existsSync(migrationPath)) {
      return fs.readFileSync(migrationPath, 'utf8');
    }
  }

  // Dist builds do not copy .sql assets, so keep a safe SQL fallback.
  return fallbackMigrationSql;
};

const getWorkspaceById = (db: NodeDatabaseSync, workspaceId: string): WorkspaceRecord => {
  const row = db.prepare(selectWorkspaceByIdSql).get({ id: workspaceId }) as WorkspaceRow | undefined;
  if (!row) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  return mapWorkspaceRow(row);
};

export const createRegistryRepository = (options: RegistryRepositoryOptions): RegistryRepository => {
  const now = options.now ?? (() => Date.now());
  const randomId = options.randomId ?? (() => crypto.randomUUID());
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

  fs.mkdirSync(path.dirname(options.dbFilePath), { recursive: true });
  const db: NodeDatabaseSync = new DatabaseSync(options.dbFilePath);
  db.exec(readMigrationSql());

  return {
    createWorkspace: (input: WorkspaceCreateInput): WorkspaceRecord => {
      const parsed = workspaceCreateSchema.parse(input);
      const timestamp = now();
      const workspaceId = randomId();

      db.prepare(insertWorkspaceSql).run({
        id: workspaceId,
        name: parsed.name,
        root_dir: parsed.rootDir,
        created_at_ms: timestamp,
        updated_at_ms: timestamp
      });

      return getWorkspaceById(db, workspaceId);
    },
    listWorkspaces: (): WorkspaceRecord[] => {
      const rows = db.prepare(selectWorkspacesSql).all() as unknown as WorkspaceRow[];
      return rows.map(mapWorkspaceRow);
    },
    getWorkspace: (workspaceId: string): WorkspaceRecord => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      return getWorkspaceById(db, parsedWorkspaceId);
    },
    hasWorkspace: (workspaceId: string): boolean => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const row = db.prepare(selectWorkspaceByIdSql).get({ id: parsedWorkspaceId }) as
        | WorkspaceRow
        | undefined;
      return row !== undefined;
    },
    openWorkspace: (workspaceId: string): WorkspaceRecord => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const timestamp = now();

      db.prepare(updateWorkspaceOpenedSql).run({
        id: parsedWorkspaceId,
        updated_at_ms: timestamp,
        last_opened_at_ms: timestamp
      });

      return getWorkspaceById(db, parsedWorkspaceId);
    },
    deleteWorkspace: (workspaceId: string): boolean => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const result = db.prepare(deleteWorkspaceSql).run({ id: parsedWorkspaceId });
      return result.changes > 0;
    },
    close: (): void => {
      db.close();
    }
  };
};
