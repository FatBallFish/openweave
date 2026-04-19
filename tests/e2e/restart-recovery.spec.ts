import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron, expect, test } from '@playwright/test';

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const getWorkspaceIdByName = (registryDbPath: string, workspaceName: string): string => {
  const registryDb = new DatabaseSync(registryDbPath);
  try {
    const row = registryDb
      .prepare('SELECT id FROM workspaces WHERE name = ? LIMIT 1')
      .get(workspaceName) as { id?: unknown } | undefined;
    if (!row || typeof row.id !== 'string') {
      throw new Error(`Workspace not found by name: ${workspaceName}`);
    }
    return row.id;
  } finally {
    registryDb.close();
  }
};

const countRunRecoveredAudits = (workspaceDbPath: string): number => {
  const workspaceDb = new DatabaseSync(workspaceDbPath);
  try {
    const row = workspaceDb
      .prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE event_type = 'run.recovered'")
      .get() as { count?: number } | undefined;
    return row?.count ?? 0;
  } finally {
    workspaceDb.close();
  }
};

const getFirstTerminalNodeId = (workspaceDbPath: string): string => {
  const workspaceDb = new DatabaseSync(workspaceDbPath);
  try {
    const row = workspaceDb
      .prepare(
        "SELECT id FROM graph_nodes WHERE component_type = 'builtin.terminal' ORDER BY updated_at_ms ASC LIMIT 1"
      )
      .get() as { id?: unknown } | undefined;
    if (!row || typeof row.id !== 'string') {
      throw new Error('Terminal node not found');
    }
    return row.id;
  } finally {
    workspaceDb.close();
  }
};

const seedQueuedRunForRecovery = (
  workspaceDbPath: string,
  workspaceId: string,
  nodeId: string,
  createdAtMs: number
): void => {
  const workspaceDb = new DatabaseSync(workspaceDbPath);
  try {
    workspaceDb
      .prepare(
        `
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
)`
      )
      .run({
        id: 'run-queued-recovery-seed',
        workspace_id: workspaceId,
        node_id: nodeId,
        runtime: 'shell',
        command: 'echo queued',
        status: 'queued',
        summary: null,
        tail_log: 'queued-tail last 4kb\n',
        created_at_ms: createdAtMs,
        started_at_ms: null,
        completed_at_ms: null,
        updated_at_ms: createdAtMs
      });
  } finally {
    workspaceDb.close();
  }
};

test('recovers queued/running runs after unclean shutdown, keeps canvas state, and avoids duplicate recovery', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-recovery-${uniqueSuffix}`);
  const workspaceName = `Recovery-${uniqueSuffix}`;
  const workspaceRoot = path.join(os.tmpdir(), `openweave-recovery-${uniqueSuffix}`);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();
    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();

    await page.getByTestId('canvas-add-note').click();
    const noteEditor = page.locator('[data-testid^="note-node-content-"]').first();
    await noteEditor.fill('Recovered note');

    await page.getByTestId('canvas-add-terminal').click();
    const commandInput = page.locator('[data-testid^="terminal-node-command-"]').first();
    const runButton = page.locator('[data-testid^="terminal-node-run-"]').first();
    const status = page.locator('[data-testid^="terminal-node-last-status-"]').first();

    await commandInput.fill('echo before-crash && sleep 20 && echo after-crash');
    await runButton.click();
    await expect(status).toContainText(/queued|running/);

    app.process()?.kill('SIGKILL');
  } finally {
    await app.close().catch(() => {
      // Process may already be terminated by SIGKILL.
    });
  }

  const workspaceId = getWorkspaceIdByName(path.join(userDataDir, 'registry.db'), workspaceName);
  const workspaceDbPath = path.join(
    userDataDir,
    'workspaces',
    `${toWorkspaceDbFileName(workspaceId)}.db`
  );
  const terminalNodeId = getFirstTerminalNodeId(workspaceDbPath);
  seedQueuedRunForRecovery(workspaceDbPath, workspaceId, terminalNodeId, Date.now() + 1);

  const restarted = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await restarted.firstWindow();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Open ${workspaceName}` }).click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await expect(page.locator('[data-testid^="note-node-content-"]').first()).toHaveValue('Recovered note');
    await expect(page.locator('[data-testid^="terminal-node-last-status-"]').first()).toContainText('failed', {
      timeout: 10000
    });

    const firstRun = page.locator('[data-testid^="terminal-run-"]').first();
    await firstRun.click();
    await expect(page.getByTestId('run-drawer-status')).toContainText('failed');
    await expect(page.getByTestId('run-drawer-tail-log')).toContainText(/before-crash|queued-tail/);

    const queuedSeedRun = page.getByTestId('terminal-run-run-queued-recovery-seed');
    await expect(queuedSeedRun).toBeVisible();
    await queuedSeedRun.click();
    await expect(page.getByTestId('run-drawer-status')).toContainText('failed');
    await expect(page.getByTestId('run-drawer-tail-log')).toContainText('queued-tail');

    const auditsAfterFirstOpen = countRunRecoveredAudits(workspaceDbPath);
    await page.getByRole('button', { name: `Open ${workspaceName}` }).click();
    await expect(page.getByTestId('active-workspace-name')).toContainText(workspaceName);
    const auditsAfterSecondOpen = countRunRecoveredAudits(workspaceDbPath);
    expect(auditsAfterSecondOpen).toBe(auditsAfterFirstOpen);
  } finally {
    await restarted.close();
  }

  expect(countRunRecoveredAudits(workspaceDbPath)).toBeGreaterThan(1);
});
