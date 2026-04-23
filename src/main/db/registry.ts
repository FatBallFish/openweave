import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import type { ComponentManifestV1 } from '../../shared/components/manifest';
import type { RoleRecord, WorkspaceGroupRecord, WorkspaceRecord } from '../../shared/ipc/contracts';
import {
  workspaceCreateSchema,
  workspaceGroupCreateSchema,
  workspaceGroupIdSchema,
  workspaceGroupMoveSchema,
  workspaceIdSchema,
  type WorkspaceCreateInput,
  type WorkspaceGroupCreateInput,
  type WorkspaceGroupMoveInput
} from '../../shared/ipc/schemas';

interface WorkspaceRow {
  id: string;
  name: string;
  root_dir: string;
  created_at_ms: number;
  updated_at_ms: number;
  last_opened_at_ms: number | null;
  icon_key: string | null;
  icon_color: string | null;
  source_workspace_id: string | null;
  branch_name: string | null;
  group_id: string | null;
}

interface WorkspaceGroupRow {
  id: string;
  name: string;
  sort_order: number;
  created_at_ms: number;
  updated_at_ms: number;
}

interface BranchWorkspaceLinkRow {
  workspace_id: string;
  source_workspace_id: string;
  branch_name: string;
  source_root_dir: string;
  target_root_dir: string;
  created_at_ms: number;
}

interface ComponentPackageRow {
  name: string;
  version: string;
  source_kind: 'builtin' | 'external';
  package_root: string;
  package_checksum: string | null;
  manifest_json: string;
  is_enabled: number;
  is_installed: number;
  created_at_ms: number;
  updated_at_ms: number;
}

const DEFAULT_WORKSPACE_ICON_KEY = 'folder-stack';
const DEFAULT_WORKSPACE_ICON_COLOR = '#64748B';

const fallbackMigrationSql = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_dir TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'folder-stack',
  icon_color TEXT NOT NULL DEFAULT '#64748B',
  group_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  last_opened_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at_ms
  ON workspaces (updated_at_ms DESC);

CREATE TABLE IF NOT EXISTS workspace_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

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
`;

const selectWorkspaceByIdSql = `
SELECT
  workspaces.id,
  workspaces.name,
  workspaces.root_dir,
  workspaces.created_at_ms,
  workspaces.updated_at_ms,
  workspaces.last_opened_at_ms,
  workspaces.icon_key,
  workspaces.icon_color,
  workspaces.group_id,
  workspace_branch_links.source_workspace_id,
  workspace_branch_links.branch_name
FROM workspaces
LEFT JOIN workspace_branch_links
  ON workspace_branch_links.workspace_id = workspaces.id
WHERE workspaces.id = @id
`;

const selectWorkspacesSql = `
SELECT
  workspaces.id,
  workspaces.name,
  workspaces.root_dir,
  workspaces.created_at_ms,
  workspaces.updated_at_ms,
  workspaces.last_opened_at_ms,
  workspaces.icon_key,
  workspaces.icon_color,
  workspaces.group_id,
  workspace_branch_links.source_workspace_id,
  workspace_branch_links.branch_name
FROM workspaces
LEFT JOIN workspace_branch_links
  ON workspace_branch_links.workspace_id = workspaces.id
ORDER BY workspaces.sort_order, workspaces.created_at_ms DESC
`;

const insertWorkspaceSql = `
INSERT INTO workspaces (
  id,
  name,
  root_dir,
  icon_key,
  icon_color,
  group_id,
  created_at_ms,
  updated_at_ms,
  last_opened_at_ms
)
VALUES (
  @id,
  @name,
  @root_dir,
  @icon_key,
  @icon_color,
  @group_id,
  @created_at_ms,
  @updated_at_ms,
  NULL
)
`;

const updateWorkspaceOpenedSql = `
UPDATE workspaces
SET updated_at_ms = @updated_at_ms,
    last_opened_at_ms = @last_opened_at_ms
WHERE id = @id
`;

const updateWorkspaceSql = `
UPDATE workspaces
SET name = @name,
    root_dir = @root_dir,
    icon_key = @icon_key,
    icon_color = @icon_color,
    group_id = @group_id,
    updated_at_ms = @updated_at_ms
WHERE id = @id
`;

const deleteWorkspaceSql = `
DELETE FROM workspaces
WHERE id = @id
`;

const insertWorkspaceGroupSql = `
INSERT INTO workspace_groups (id, name, sort_order, created_at_ms, updated_at_ms)
VALUES (@id, @name, @sort_order, @created_at_ms, @updated_at_ms)
`;

const selectWorkspaceGroupByIdSql = `
SELECT id, name, sort_order, created_at_ms, updated_at_ms
FROM workspace_groups
WHERE id = @id
`;

const selectMaxWorkspaceGroupSortOrderSql = `
SELECT COALESCE(MAX(sort_order), -1) as max_sort_order
FROM workspace_groups
`;

const selectWorkspaceIdsByGroupSql = `
SELECT id
FROM workspaces
WHERE (group_id IS NULL AND @group_id IS NULL)
   OR group_id = @group_id
ORDER BY sort_order, created_at_ms DESC
`;

const updateWorkspaceGroupIdSql = `
UPDATE workspaces
SET group_id = @group_id,
    updated_at_ms = @updated_at_ms
WHERE id = @id
`;

const deleteWorkspaceGroupSql = `
DELETE FROM workspace_groups
WHERE id = @id
`;

const selectWorkspaceGroupsSql = `
SELECT id, name, sort_order, created_at_ms, updated_at_ms
FROM workspace_groups
ORDER BY sort_order, created_at_ms DESC
`;

const selectWorkspaceGroupUiStateSql = `
SELECT group_id, is_collapsed, updated_at_ms
FROM workspace_group_ui_state
`;

const upsertWorkspaceGroupUiStateSql = `
INSERT INTO workspace_group_ui_state (group_id, is_collapsed, updated_at_ms)
VALUES (@group_id, @is_collapsed, @updated_at_ms)
ON CONFLICT(group_id) DO UPDATE SET
  is_collapsed = excluded.is_collapsed,
  updated_at_ms = excluded.updated_at_ms
`;

const updateWorkspaceGroupNameSql = `
UPDATE workspace_groups
SET name = @name,
    updated_at_ms = @updated_at_ms
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

const upsertComponentPackageSql = `
INSERT INTO component_packages (
  name,
  version,
  source_kind,
  package_root,
  package_checksum,
  manifest_json,
  is_enabled,
  is_installed,
  created_at_ms,
  updated_at_ms
)
VALUES (
  @name,
  @version,
  @source_kind,
  @package_root,
  @package_checksum,
  @manifest_json,
  @is_enabled,
  @is_installed,
  @created_at_ms,
  @updated_at_ms
)
ON CONFLICT(name, version) DO UPDATE SET
  source_kind = excluded.source_kind,
  package_root = excluded.package_root,
  package_checksum = excluded.package_checksum,
  manifest_json = excluded.manifest_json,
  is_enabled = excluded.is_enabled,
  is_installed = excluded.is_installed,
  updated_at_ms = excluded.updated_at_ms
`;

const selectComponentPackageSql = `
SELECT
  name,
  version,
  source_kind,
  package_root,
  package_checksum,
  manifest_json,
  is_enabled,
  is_installed,
  created_at_ms,
  updated_at_ms
FROM component_packages
WHERE name = @name AND version = @version
`;

const selectComponentPackagesSql = `
SELECT
  name,
  version,
  source_kind,
  package_root,
  package_checksum,
  manifest_json,
  is_enabled,
  is_installed,
  created_at_ms,
  updated_at_ms
FROM component_packages
ORDER BY name ASC, version ASC
`;

const updateComponentPackageStatusSql = `
UPDATE component_packages
SET is_enabled = @is_enabled,
    is_installed = @is_installed,
    updated_at_ms = @updated_at_ms
WHERE name = @name AND version = @version
`;

const selectRolesSql = `
SELECT id, name, description, icon, color, created_at_ms, updated_at_ms
FROM roles
ORDER BY updated_at_ms DESC
`;

const selectRoleByIdSql = `
SELECT id, name, description, icon, color, created_at_ms, updated_at_ms
FROM roles
WHERE id = @id
`;

const upsertRoleSql = `
INSERT INTO roles (id, name, description, icon, color, created_at_ms, updated_at_ms)
VALUES (@id, @name, @description, @icon, @color, @created_at_ms, @updated_at_ms)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  updated_at_ms = excluded.updated_at_ms
`;

const deleteRoleSql = `
DELETE FROM roles WHERE id = @id
`;

const mapRoleRow = (row: {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  created_at_ms: number;
  updated_at_ms: number;
}): RoleRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  icon: row.icon,
  color: row.color,
  createdAtMs: row.created_at_ms,
  updatedAtMs: row.updated_at_ms
});

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

export interface ComponentPackageRecord {
  name: string;
  version: string;
  sourceKind: 'builtin' | 'external';
  packageRoot: string;
  packageChecksum: string | null;
  manifest: ComponentManifestV1;
  isEnabled: boolean;
  isInstalled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UpsertComponentPackageInput {
  name: string;
  version: string;
  sourceKind: 'builtin' | 'external';
  packageRoot: string;
  packageChecksum?: string | null;
  manifest: ComponentManifestV1;
  isEnabled: boolean;
  isInstalled: boolean;
}

export interface RegistryRepository {
  createWorkspace: (input: WorkspaceCreateInput) => WorkspaceRecord;
  listWorkspaces: () => WorkspaceRecord[];
  getWorkspace: (workspaceId: string) => WorkspaceRecord;
  hasWorkspace: (workspaceId: string) => boolean;
  openWorkspace: (workspaceId: string) => WorkspaceRecord;
  updateWorkspace: (input: {
    workspaceId: string;
    name: string;
    rootDir: string;
    iconKey: string;
    iconColor: string;
    groupId?: string;
  }) => WorkspaceRecord;
  createWorkspaceGroup: (input: WorkspaceGroupCreateInput) => WorkspaceGroupRecord;
  getWorkspaceGroup: (groupId: string) => WorkspaceGroupRecord;
  listWorkspaceGroups: () => WorkspaceGroupRecord[];
  updateWorkspaceGroup: (groupId: string, name: string) => WorkspaceGroupRecord;
  moveWorkspaceToGroup: (input: WorkspaceGroupMoveInput) => void;
  moveWorkspaceToUngrouped: (workspaceId: string, targetIndex?: number) => void;
  deleteWorkspaceGroup: (groupId: string) => boolean;
  listWorkspaceGroupUiState: () => Array<{ groupId: string; collapsed: boolean; updatedAtMs: number }>;
  setWorkspaceGroupCollapsed: (groupId: string, collapsed: boolean) => { groupId: string; collapsed: boolean; updatedAtMs: number };
  reorderUngroupedWorkspaces: (workspaceIds: string[]) => void;
  reorderWorkspaceGroups: (groupIds: string[]) => void;
  reorderGroupMembers: (groupId: string, workspaceIds: string[]) => void;
  upsertBranchWorkspaceLink: (input: UpsertBranchWorkspaceLinkInput) => BranchWorkspaceLinkRecord;
  getBranchWorkspaceLink: (workspaceId: string) => BranchWorkspaceLinkRecord | null;
  deleteBranchWorkspaceLink: (workspaceId: string) => void;
  upsertComponentPackage: (input: UpsertComponentPackageInput) => ComponentPackageRecord;
  getComponentPackage: (name: string, version: string) => ComponentPackageRecord | null;
  listComponentPackages: () => ComponentPackageRecord[];
  setComponentPackageStatus: (
    name: string,
    version: string,
    status: { isEnabled: boolean; isInstalled: boolean }
  ) => void;
  listRoles: () => RoleRecord[];
  getRole: (id: string) => RoleRecord | null;
  saveRole: (role: RoleRecord) => RoleRecord;
  deleteRole: (id: string) => boolean;
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
    lastOpenedAtMs: row.last_opened_at_ms,
    iconKey: row.icon_key ?? DEFAULT_WORKSPACE_ICON_KEY,
    iconColor: row.icon_color ?? DEFAULT_WORKSPACE_ICON_COLOR,
    sourceWorkspaceId: row.source_workspace_id ?? null,
    branchName: row.branch_name ?? null,
    groupId: row.group_id ?? null
  };
};

const mapWorkspaceGroupRow = (row: WorkspaceGroupRow): WorkspaceGroupRecord => {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
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

const mapComponentPackageRow = (row: ComponentPackageRow): ComponentPackageRecord => {
  return {
    name: row.name,
    version: row.version,
    sourceKind: row.source_kind,
    packageRoot: row.package_root,
    packageChecksum: row.package_checksum,
    manifest: JSON.parse(row.manifest_json) as ComponentManifestV1,
    isEnabled: row.is_enabled === 1,
    isInstalled: row.is_installed === 1,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  };
};

const ensureWorkspaceSchema = (db: NodeDatabaseSync): void => {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'").get() as { name: string } | undefined;
  if (!tableCheck) {
    return;
  }

  const columns = db.prepare('PRAGMA table_info(workspaces)').all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));

  if (!names.has('icon_key')) {
    db.exec(`ALTER TABLE workspaces ADD COLUMN icon_key TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ICON_KEY}'`);
  }

  if (!names.has('icon_color')) {
    db.exec(`ALTER TABLE workspaces ADD COLUMN icon_color TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ICON_COLOR}'`);
  }

  if (!names.has('group_id')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN group_id TEXT');
  }

  if (!names.has('sort_order')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  }
};

const ensureWorkspaceGroupSchema = (db: NodeDatabaseSync): void => {
  db.exec(`
CREATE TABLE IF NOT EXISTS workspace_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`);

  db.exec(`
CREATE TABLE IF NOT EXISTS workspace_group_ui_state (
  group_id TEXT PRIMARY KEY,
  is_collapsed INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES workspace_groups(id) ON DELETE CASCADE
);
`);
};

const ensureComponentPackageSchema = (db: NodeDatabaseSync): void => {
  const columns = db.prepare('PRAGMA table_info(component_packages)').all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('package_checksum')) {
    db.exec('ALTER TABLE component_packages ADD COLUMN package_checksum TEXT');
  }
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

  return fallbackMigrationSql;
};

const readRolesMigrationSql = (): string => {
  const candidates = [
    path.resolve(__dirname, 'migrations/registry/002_roles.sql'),
    path.resolve(process.cwd(), 'src/main/db/migrations/registry/002_roles.sql')
  ];

  for (const migrationPath of candidates) {
    if (fs.existsSync(migrationPath)) {
      return fs.readFileSync(migrationPath, 'utf8');
    }
  }

  return `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0078d4',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roles_updated_at_ms ON roles (updated_at_ms DESC);
`;
};

const getWorkspaceById = (db: NodeDatabaseSync, workspaceId: string): WorkspaceRecord => {
  const row = db.prepare(selectWorkspaceByIdSql).get({ id: workspaceId }) as WorkspaceRow | undefined;
  if (!row) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  return mapWorkspaceRow(row);
};

const getWorkspaceGroupById = (db: NodeDatabaseSync, groupId: string): WorkspaceGroupRecord => {
  const row = db.prepare(selectWorkspaceGroupByIdSql).get({ id: groupId }) as WorkspaceGroupRow | undefined;
  if (!row) {
    throw new Error(`Workspace group not found: ${groupId}`);
  }
  return mapWorkspaceGroupRow(row);
};

const ensureTopLevelWorkspace = (workspace: WorkspaceRecord): void => {
  if (workspace.sourceWorkspaceId) {
    throw new Error('Only top-level workspaces can be grouped');
  }
};

const selectWorkspaceIdsByGroup = (db: NodeDatabaseSync, groupId: string | null): string[] => {
  const rows = db.prepare(selectWorkspaceIdsByGroupSql).all({ group_id: groupId }) as Array<{ id: string }>;
  return rows.map((row) => row.id);
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
  // Ensure old tables are upgraded before running migration SQL
  // (CREATE INDEX in migration SQL may reference columns added here)
  ensureWorkspaceSchema(db);
  db.exec(readMigrationSql());
  db.exec(readRolesMigrationSql());
  ensureWorkspaceGroupSchema(db);
  ensureComponentPackageSchema(db);

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
        icon_key: parsed.iconKey ?? DEFAULT_WORKSPACE_ICON_KEY,
        icon_color: parsed.iconColor ?? DEFAULT_WORKSPACE_ICON_COLOR,
        group_id: null,
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
      const row = db.prepare(selectWorkspaceByIdSql).get({ id: parsedWorkspaceId }) as WorkspaceRow | undefined;
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
    updateWorkspace: (input): WorkspaceRecord => {
      const parsedWorkspaceId = workspaceIdSchema.parse(input.workspaceId);
      const timestamp = now();
      const canonicalRootDir = toCanonicalWorkspaceRootDir(input.rootDir);

      db.prepare(updateWorkspaceSql).run({
        id: parsedWorkspaceId,
        name: input.name,
        root_dir: canonicalRootDir,
        icon_key: input.iconKey,
        icon_color: input.iconColor,
        group_id: input.groupId ?? null,
        updated_at_ms: timestamp
      });

      return getWorkspaceById(db, parsedWorkspaceId);
    },
    createWorkspaceGroup: (input: WorkspaceGroupCreateInput): WorkspaceGroupRecord => {
      const parsed = workspaceGroupCreateSchema.parse(input);
      const timestamp = now();
      const groupId = randomId();
      const maxSortRow = db.prepare(selectMaxWorkspaceGroupSortOrderSql).get() as { max_sort_order: number };

      db.prepare(insertWorkspaceGroupSql).run({
        id: groupId,
        name: parsed.name,
        sort_order: maxSortRow.max_sort_order + 1,
        created_at_ms: timestamp,
        updated_at_ms: timestamp
      });

      return getWorkspaceGroupById(db, groupId);
    },
    getWorkspaceGroup: (groupId: string): WorkspaceGroupRecord => {
      const parsedGroupId = workspaceGroupIdSchema.parse(groupId);
      return getWorkspaceGroupById(db, parsedGroupId);
    },
    moveWorkspaceToGroup: (input: WorkspaceGroupMoveInput): void => {
      const parsed = workspaceGroupMoveSchema.parse(input);
      const timestamp = now();

      const workspace = getWorkspaceById(db, parsed.workspaceId);
      ensureTopLevelWorkspace(workspace);
      getWorkspaceGroupById(db, parsed.groupId);

      const memberIds = selectWorkspaceIdsByGroup(db, parsed.groupId);
      const filteredIds = memberIds.filter((id) => id !== parsed.workspaceId);
      const insertIndex = Math.min(parsed.targetIndex, filteredIds.length);
      filteredIds.splice(insertIndex, 0, parsed.workspaceId);

      for (let i = 0; i < filteredIds.length; i++) {
        db.prepare(`
          UPDATE workspaces
          SET sort_order = @sort_order, group_id = @group_id, updated_at_ms = @updated_at_ms
          WHERE id = @id
        `).run({
          id: filteredIds[i],
          group_id: parsed.groupId,
          sort_order: i,
          updated_at_ms: timestamp + i
        });
      }
    },
    deleteWorkspaceGroup: (groupId: string): boolean => {
      const parsedGroupId = workspaceGroupIdSchema.parse(groupId);
      const timestamp = now();

      const memberIds = selectWorkspaceIdsByGroup(db, parsedGroupId);
      for (const workspaceId of memberIds) {
        db.prepare(updateWorkspaceGroupIdSql).run({
          id: workspaceId,
          group_id: null,
          updated_at_ms: timestamp
        });
      }

      const result = db.prepare(deleteWorkspaceGroupSql).run({ id: parsedGroupId });
      return result.changes > 0;
    },
    listWorkspaceGroups: (): WorkspaceGroupRecord[] => {
      const rows = db.prepare(selectWorkspaceGroupsSql).all() as unknown as WorkspaceGroupRow[];
      return rows.map(mapWorkspaceGroupRow);
    },
    updateWorkspaceGroup: (groupId: string, name: string): WorkspaceGroupRecord => {
      const parsedGroupId = workspaceGroupIdSchema.parse(groupId);
      const timestamp = now();

      db.prepare(updateWorkspaceGroupNameSql).run({
        id: parsedGroupId,
        name,
        updated_at_ms: timestamp
      });

      return getWorkspaceGroupById(db, parsedGroupId);
    },
    moveWorkspaceToUngrouped: (workspaceId: string, targetIndex?: number): void => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const timestamp = now();

      const workspace = getWorkspaceById(db, parsedWorkspaceId);
      ensureTopLevelWorkspace(workspace);

      const ungroupedIds = selectWorkspaceIdsByGroup(db, null);
      const filteredIds = ungroupedIds.filter((id) => id !== parsedWorkspaceId);
      const insertIndex = targetIndex !== undefined ? Math.min(targetIndex, filteredIds.length) : filteredIds.length;
      filteredIds.splice(insertIndex, 0, parsedWorkspaceId);

      for (let i = 0; i < filteredIds.length; i++) {
        db.prepare(`
          UPDATE workspaces
          SET sort_order = @sort_order, group_id = NULL, updated_at_ms = @updated_at_ms
          WHERE id = @id
        `).run({
          id: filteredIds[i],
          sort_order: i,
          updated_at_ms: timestamp + i
        });
      }
    },
    listWorkspaceGroupUiState: (): Array<{ groupId: string; collapsed: boolean; updatedAtMs: number }> => {
      const rows = db.prepare(selectWorkspaceGroupUiStateSql).all() as Array<{ group_id: string; is_collapsed: number; updated_at_ms: number }>;
      return rows.map((row) => ({
        groupId: row.group_id,
        collapsed: Boolean(row.is_collapsed),
        updatedAtMs: row.updated_at_ms
      }));
    },
    setWorkspaceGroupCollapsed: (groupId: string, collapsed: boolean): { groupId: string; collapsed: boolean; updatedAtMs: number } => {
      const parsedGroupId = workspaceGroupIdSchema.parse(groupId);
      const timestamp = now();

      db.prepare(upsertWorkspaceGroupUiStateSql).run({
        group_id: parsedGroupId,
        is_collapsed: collapsed ? 1 : 0,
        updated_at_ms: timestamp
      });

      return { groupId: parsedGroupId, collapsed, updatedAtMs: timestamp };
    },
    reorderUngroupedWorkspaces: (workspaceIds: string[]): void => {
      const timestamp = now();
      for (let index = 0; index < workspaceIds.length; index++) {
        db.prepare(`
          UPDATE workspaces
          SET sort_order = @sort_order, updated_at_ms = @updated_at_ms
          WHERE id = @id AND (group_id IS NULL)
        `).run({
          id: workspaceIds[index],
          sort_order: index,
          updated_at_ms: timestamp
        });
      }
    },
    reorderWorkspaceGroups: (groupIds: string[]): void => {
      const timestamp = now();
      for (let index = 0; index < groupIds.length; index++) {
        db.prepare(`
          UPDATE workspace_groups
          SET sort_order = @sort_order, updated_at_ms = @updated_at_ms
          WHERE id = @id
        `).run({
          id: groupIds[index],
          sort_order: index,
          updated_at_ms: timestamp
        });
      }
    },
    reorderGroupMembers: (groupId: string, workspaceIds: string[]): void => {
      const parsedGroupId = workspaceGroupIdSchema.parse(groupId);
      const timestamp = now();
      for (let index = 0; index < workspaceIds.length; index++) {
        db.prepare(`
          UPDATE workspaces
          SET sort_order = @sort_order, updated_at_ms = @updated_at_ms
          WHERE id = @id AND group_id = @group_id
        `).run({
          id: workspaceIds[index],
          group_id: parsedGroupId,
          sort_order: index,
          updated_at_ms: timestamp
        });
      }
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
    upsertComponentPackage: (input: UpsertComponentPackageInput): ComponentPackageRecord => {
      const timestamp = now();

      db.prepare(upsertComponentPackageSql).run({
        name: input.name,
        version: input.version,
        source_kind: input.sourceKind,
        package_root: path.resolve(input.packageRoot),
        package_checksum: input.packageChecksum ?? null,
        manifest_json: JSON.stringify(input.manifest),
        is_enabled: input.isEnabled ? 1 : 0,
        is_installed: input.isInstalled ? 1 : 0,
        created_at_ms: timestamp,
        updated_at_ms: timestamp
      });

      const row = db.prepare(selectComponentPackageSql).get({
        name: input.name,
        version: input.version
      }) as ComponentPackageRow | undefined;
      if (!row) {
        throw new Error(`Component package not found: ${input.name}@${input.version}`);
      }
      return mapComponentPackageRow(row);
    },
    getComponentPackage: (name: string, version: string): ComponentPackageRecord | null => {
      const row = db.prepare(selectComponentPackageSql).get({
        name,
        version
      }) as ComponentPackageRow | undefined;
      return row ? mapComponentPackageRow(row) : null;
    },
    listComponentPackages: (): ComponentPackageRecord[] => {
      const rows = db.prepare(selectComponentPackagesSql).all() as unknown as ComponentPackageRow[];
      return rows.map(mapComponentPackageRow);
    },
    setComponentPackageStatus: (
      name: string,
      version: string,
      status: { isEnabled: boolean; isInstalled: boolean }
    ): void => {
      db.prepare(updateComponentPackageStatusSql).run({
        name,
        version,
        is_enabled: status.isEnabled ? 1 : 0,
        is_installed: status.isInstalled ? 1 : 0,
        updated_at_ms: now()
      });
    },
    listRoles: (): RoleRecord[] => {
      const rows = db.prepare(selectRolesSql).all() as unknown as Array<{
        id: string; name: string; description: string; icon: string;
        color: string; created_at_ms: number; updated_at_ms: number;
      }>;
      return rows.map(mapRoleRow);
    },
    getRole: (id: string): RoleRecord | null => {
      const row = db.prepare(selectRoleByIdSql).get({ id }) as unknown as {
        id: string; name: string; description: string; icon: string;
        color: string; created_at_ms: number; updated_at_ms: number;
      } | undefined;
      return row ? mapRoleRow(row) : null;
    },
    saveRole: (role: RoleRecord): RoleRecord => {
      db.prepare(upsertRoleSql).run({
        id: role.id,
        name: role.name,
        description: role.description,
        icon: role.icon,
        color: role.color,
        created_at_ms: role.createdAtMs,
        updated_at_ms: role.updatedAtMs
      });
      const saved = db.prepare(selectRoleByIdSql).get({ id: role.id }) as unknown as {
        id: string; name: string; description: string; icon: string;
        color: string; created_at_ms: number; updated_at_ms: number;
      } | undefined;
      if (!saved) throw new Error(`Role not found after save: ${role.id}`);
      return mapRoleRow(saved);
    },
    deleteRole: (id: string): boolean => {
      const result = db.prepare(deleteRoleSql).run({ id });
      return (result.changes ?? 0) > 0;
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
