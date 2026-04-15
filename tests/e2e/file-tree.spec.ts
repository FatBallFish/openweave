import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
  writeFile(path.join(rootDir, 'node_modules/pkg/index.js'), 'module.exports = 1;\n');
  runGit(rootDir, ['add', 'src/app.ts']);
  runGit(rootDir, ['commit', '-m', 'init']);
  writeFile(path.join(rootDir, 'src/app.ts'), 'export const app = 2;\n');
};

test('shows file tree and git status as read-only surfaces', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-file-tree-${uniqueSuffix}`);
  const repoRootDir = path.join(os.tmpdir(), `openweave-e2e-repo-${uniqueSuffix}`);
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
    const workspaceName = `Repo-${uniqueSuffix}`;

    await expect(page.getByTestId('workspace-list-page')).toBeVisible();
    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(repoRootDir);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await page.getByTestId('canvas-add-file-tree').click();

    const fileTreeList = page.locator('[data-testid^="file-tree-node-list-"]').first();
    await expect(fileTreeList).toContainText('src/app.ts');
    await expect(fileTreeList).toContainText('M');
    await expect(fileTreeList).not.toContainText('node_modules');

    const gitPanel = page.locator('[data-testid^="git-panel-"]').first();
    await expect(gitPanel).toContainText('Modified: 1');
    await expect(gitPanel).toContainText('Read-only mode');
  } finally {
    await app.close();
  }
});

test('loads non-git directories while keeping git panel read-only', async () => {
  const uniqueSuffix = `${Date.now()}-plain`;
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-file-tree-${uniqueSuffix}`);
  const plainRootDir = path.join(os.tmpdir(), `openweave-e2e-plain-${uniqueSuffix}`);
  writeFile(path.join(plainRootDir, 'src/plain.txt'), 'plain\n');

  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    const workspaceName = `Plain-${uniqueSuffix}`;

    await expect(page.getByTestId('workspace-list-page')).toBeVisible();
    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(plainRootDir);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await page.getByTestId('canvas-add-file-tree').click();

    const fileTreeList = page.locator('[data-testid^="file-tree-node-list-"]').first();
    await expect(fileTreeList).toContainText('src/plain.txt');

    const gitPanel = page.locator('[data-testid^="git-panel-"]').first();
    await expect(gitPanel).toContainText('Git repository not detected');
    await expect(gitPanel).toContainText('Read-only mode');
  } finally {
    await app.close();
  }
});
