import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { _electron as electron, expect, test } from '@playwright/test';

const resolveElectronLaunchOptions = (
  userDataDir: string
): {
  args?: string[];
  executablePath?: string;
  env: NodeJS.ProcessEnv;
} => {
  const packagedExecutablePath = process.env.OPENWEAVE_PACKAGED_EXECUTABLE;
  return {
    args: packagedExecutablePath ? undefined : [path.resolve(__dirname, '../../dist/main/main.js')],
    executablePath: packagedExecutablePath ? path.resolve(packagedExecutablePath) : undefined,
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  };
};

test('runs a terminal command and shows queued to completed status', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-terminal-run-${uniqueSuffix}`);
  const workspaceName = `Terminal-${uniqueSuffix}`;
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-terminal-'));
  const app = await electron.launch(resolveElectronLaunchOptions(userDataDir));

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await page.getByTestId('canvas-add-terminal').click();

    const terminalCommand = page.locator('[data-testid^="terminal-node-command-"]').first();
    const terminalRunButton = page.locator('[data-testid^="terminal-node-run-"]').first();
    const lastStatus = page.locator('[data-testid^="terminal-node-last-status-"]').first();

    await terminalCommand.fill('echo hello && sleep 0.2');
    await terminalRunButton.click();

    await expect(lastStatus).toContainText(/queued|running|completed/);
    await expect(lastStatus).toContainText('completed', { timeout: 10000 });

    await expect(page.getByTestId('run-drawer')).toBeVisible();
    await expect(page.getByTestId('run-drawer-status')).toContainText('completed', {
      timeout: 10000
    });
    await expect(page.getByTestId('run-drawer-summary')).toContainText('hello');
    await expect(page.getByTestId('run-drawer-tail-log')).toContainText('hello');
  } finally {
    await app.close();
  }
});
