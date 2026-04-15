import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron, expect, test } from '@playwright/test';

interface SeedWorkspaceInput {
  id: string;
  name: string;
  rootDir: string;
}

const resolvePackagedExecutablePath = (): string => {
  const executablePath = process.env.OPENWEAVE_PACKAGED_EXECUTABLE;
  if (!executablePath) {
    throw new Error('OPENWEAVE_PACKAGED_EXECUTABLE is required for packaged alpha smoke tests.');
  }
  return path.resolve(executablePath);
};

const seedWorkspace = (userDataDir: string, workspace: SeedWorkspaceInput): void => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(workspace.rootDir, { recursive: true });

  const dbPath = path.join(userDataDir, 'registry.db');
  const db = new DatabaseSync(dbPath);

  try {
    db.exec(`
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
    `);

    const now = Date.now();
    db.prepare(`
      INSERT INTO workspaces (id, name, root_dir, created_at_ms, updated_at_ms, last_opened_at_ms)
      VALUES (@id, @name, @root_dir, @created_at_ms, @updated_at_ms, NULL)
    `).run({
      id: workspace.id,
      name: workspace.name,
      root_dir: workspace.rootDir,
      created_at_ms: now,
      updated_at_ms: now
    });
  } finally {
    db.close();
  }
};

test('launches the packaged app and opens an existing workspace', async () => {
  const uniqueSuffix = Date.now().toString();
  const workspaceName = `Alpha-Workspace-${uniqueSuffix}`;
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-alpha-user-${uniqueSuffix}`);
  const workspaceRootDir = path.join(os.tmpdir(), `openweave-e2e-alpha-root-${uniqueSuffix}`);
  const workspaceId = crypto.randomUUID();

  seedWorkspace(userDataDir, {
    id: workspaceId,
    name: workspaceName,
    rootDir: workspaceRootDir
  });

  const app = await electron.launch({
    executablePath: resolvePackagedExecutablePath(),
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Open ${workspaceName}` }).click();
    await expect(page.getByTestId('active-workspace-name')).toContainText(workspaceName);
  } finally {
    await app.close();
  }
});
