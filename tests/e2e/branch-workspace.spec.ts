import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

const runGit = (cwd: string, args: string[]): void => {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      LC_ALL: 'C'
    }
  });
};

const writeFile = (targetPath: string, content: string): void => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
};

const createFixtureRepo = (rootDir: string): void => {
  runGit(rootDir, ['init']);
  runGit(rootDir, ['config', 'user.name', 'OpenWeave E2E']);
  runGit(rootDir, ['config', 'user.email', 'openweave-e2e@example.com']);
  writeFile(path.join(rootDir, 'src/app.ts'), 'export const app = 1;\n');
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '-m', 'init']);
};

const startPortalFixtureServer = async (): Promise<{
  origin: string;
  close: () => Promise<void>;
}> => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8'
    });
    response.end('<!doctype html><html><body><h1>Branch Workspace Portal</h1></body></html>');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start portal fixture server');
  }

  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
};

test('creates a branch workspace with isolated run state and copied portal URL', async () => {
  const fixture = await startPortalFixtureServer();
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-branch-${uniqueSuffix}`);
  const repoRootDir = path.join(os.tmpdir(), `openweave-e2e-branch-repo-${uniqueSuffix}`);
  fs.mkdirSync(repoRootDir, { recursive: true });
  createFixtureRepo(repoRootDir);

  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    const workspaceName = `Workspace-${uniqueSuffix}`;
    const branchName = `feature/demo-${uniqueSuffix}`;
    const portalUrl = `${fixture.origin}/demo`;

    await expect(page.getByTestId('workspace-list-page')).toBeVisible();
    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(repoRootDir);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await page.getByTestId('workbench-topbar-action-add-portal').click();
    await page.getByTestId('workbench-topbar-action-add-terminal').click();
    await page.getByTestId('workbench-topbar-action-add-file-tree').click();

    const portalUrlInput = page.locator('[data-testid^="portal-url-input-"]').first();
    const portalLoadButton = page.locator('[data-testid^="portal-load-"]').first();
    await portalUrlInput.fill(portalUrl);
    await portalLoadButton.click();
    await expect(page.locator('[data-testid^="portal-action-status-"]').first()).toContainText(
      'Loaded portal URL',
      { timeout: 10000 }
    );

    const runButton = page.locator('[data-testid^="terminal-node-run-"]').first();
    await runButton.click();
    await expect(page.locator('[data-testid^="terminal-node-last-status-"]').first()).toContainText(
      'completed',
      { timeout: 10000 }
    );

    await page.locator('[data-testid^="git-panel-branch-workspace-"]').first().click();
    await expect(page.getByTestId('branch-workspace-dialog')).toBeVisible();
    await page.getByTestId('branch-workspace-branch-input').fill(branchName);
    await page.getByTestId('branch-workspace-copy-canvas').check();
    await page.getByTestId('branch-workspace-submit').click();

    await expect(page.getByTestId('active-workspace-name')).toContainText(branchName, {
      timeout: 10000
    });
    await expect(page.getByTestId('canvas-workspace-name')).toContainText(branchName, {
      timeout: 10000
    });

    await expect(page.locator('[data-testid^="portal-url-input-"]').first()).toHaveValue(portalUrl);
    await expect(page.locator('[data-testid^="terminal-node-runs-"]').first()).toContainText('No runs yet.');
  } finally {
    await app.close();
    await fixture.close();
  }
});
