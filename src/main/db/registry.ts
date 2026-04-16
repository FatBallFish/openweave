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

interface BranchWorkspaceLinkRow {
  workspace_id: string;
  source_workspace_id: string;
  branch_name: string;
  source_root_dir: string;
  target_root_dir: string;
  created_at_ms: number;
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

const upsertBranchWorkspaceLinkSql = `
INSERT INTO workspace_branch_links (
  workspace_id,
  source_workspace_id,
  branch_name,
  source_root_dir,
  target_root_dir,
  created_at_ms
)
VALUES (
  @workspace_id,
  @source_workspace_id,
  @branch_name,
  @source_root_dir,
  @target_root_dir,
  @created_at_ms
)
ON CONFLICT(workspace_id) DO UPDATE SET
  source_workspace_id = excluded.source_workspace_id,
  branch_name = excluded.branch_name,
  source_root_dir = excluded.source_root_dir,
  target_root_dir = excluded.target_root_dir,
  created_at_ms = excluded.created_at_ms
`;

const selectBranchWorkspaceLinkSql = `
SELECT
  workspace_id,
  source_workspace_id,
  branch_name,
  source_root_dir,
  target_root_dir,
  created_at_ms
FROM workspace_branch_links
WHERE workspace_id = @workspace_id
`;

const deleteBranchWorkspaceLinkSql = `
DELETE FROM workspace_branch_links
WHERE workspace_id = @workspace_id
`;

export interface RegistryRepositoryOptions {
  dbFilePath: string;
  now?: () => number;
  randomId?: () => string;
}

export interface BranchWorkspaceLinkRecord {
  workspaceId: string;
  sourceWorkspaceId: string;
  branchName: string;
  sourceRootDir: string;
  targetRootDir: string;
  createdAtMs: number;
}

export interface UpsertBranchWorkspaceLinkInput {
  workspaceId: string;
  sourceWorkspaceId: string;
  branchName: string;
  sourceRootDir: string;
  targetRootDir: string;
}

export interface RegistryRepository {
  createWorkspace: (input: WorkspaceCreateInput) => WorkspaceRecord;
  listWorkspaces: () => WorkspaceRecord[];
  getWorkspace: (workspaceId: string) => WorkspaceRecord;
  hasWorkspace: (workspaceId: string) => boolean;
  openWorkspace: (workspaceId: string) => WorkspaceRecord;
  upsertBranchWorkspaceLink: (input: UpsertBranchWorkspaceLinkInput) => BranchWorkspaceLinkRecord;
  getBranchWorkspaceLink: (workspaceId: string) => BranchWorkspaceLinkRecord | null;
  deleteBranchWorkspaceLink: (workspaceId: string) => void;
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

const mapBranchWorkspaceLinkRow = (row: BranchWorkspaceLinkRow): BranchWorkspaceLinkRecord => {
  return {
    workspaceId: row.workspace_id,
    sourceWorkspaceId: row.source_workspace_id,
    branchName: row.branch_name,
    sourceRootDir: row.source_root_dir,
    targetRootDir: row.target_root_dir,
    createdAtMs: row.created_at_ms
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

const toCanonicalWorkspaceRootDir = (rootDir: string): string => {
  const resolvedPath = path.resolve(rootDir);
  let canonicalPath: string;

  try {
    canonicalPath = fs.realpathSync(resolvedPath);
  } catch {
    throw new Error(`Workspace root directory does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(canonicalPath);
  if (!stats.isDirectory()) {
    throw new Error(`Workspace root directory must be a directory: ${canonicalPath}`);
  }

  return canonicalPath;
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
      const canonicalRootDir = toCanonicalWorkspaceRootDir(parsed.rootDir);

      db.prepare(insertWorkspaceSql).run({
        id: workspaceId,
        name: parsed.name,
        root_dir: canonicalRootDir,
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
    upsertBranchWorkspaceLink: (input: UpsertBranchWorkspaceLinkInput): BranchWorkspaceLinkRecord => {
      const timestamp = now();
      const workspaceId = workspaceIdSchema.parse(input.workspaceId);
      const sourceWorkspaceId = workspaceIdSchema.parse(input.sourceWorkspaceId);

      db.prepare(upsertBranchWorkspaceLinkSql).run({
        workspace_id: workspaceId,
        source_workspace_id: sourceWorkspaceId,
        branch_name: input.branchName,
        source_root_dir: input.sourceRootDir,
        target_root_dir: input.targetRootDir,
        created_at_ms: timestamp
      });

      const row = db.prepare(selectBranchWorkspaceLinkSql).get({ workspace_id: workspaceId }) as
        | BranchWorkspaceLinkRow
        | undefined;
      if (!row) {
        throw new Error(`Branch workspace link not found: ${workspaceId}`);
      }
      return mapBranchWorkspaceLinkRow(row);
    },
    getBranchWorkspaceLink: (workspaceId: string): BranchWorkspaceLinkRecord | null => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const row = db.prepare(selectBranchWorkspaceLinkSql).get({
        workspace_id: parsedWorkspaceId
      }) as BranchWorkspaceLinkRow | undefined;
      if (!row) {
        return null;
      }
      return mapBranchWorkspaceLinkRow(row);
    },
    deleteBranchWorkspaceLink: (workspaceId: string): void => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      db.prepare(deleteBranchWorkspaceLinkSql).run({
        workspace_id: parsedWorkspaceId
      });
    },
    deleteWorkspace: (workspaceId: string): boolean => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      db.prepare(deleteBranchWorkspaceLinkSql).run({ workspace_id: parsedWorkspaceId });
      const result = db.prepare(deleteWorkspaceSql).run({ id: parsedWorkspaceId });
      return result.changes > 0;
    },
    close: (): void => {
      db.close();
    }
  };
};
