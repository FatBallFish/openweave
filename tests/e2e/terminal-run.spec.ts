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

test('runs an interactive terminal session, accepts follow-up input, and stops cleanly', async () => {
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
    const terminalRuntime = page.locator('[data-testid^="terminal-node-runtime-"]').first();
    const lastStatus = page.locator('[data-testid^="terminal-node-last-status-"]').first();

    await terminalRuntime.selectOption('shell');
    await terminalCommand.fill("/bin/sh -lc 'echo ready; while read line; do echo $line; done'");
    await terminalCommand.press('Enter');

    await expect(lastStatus).toContainText(/queued|running/);

    await expect(page.getByTestId('run-drawer')).toBeVisible();
    await expect(page.getByTestId('terminal-session-output')).toContainText('ready', {
      timeout: 10000
    });

    const sessionInput = page.getByTestId('terminal-session-input');
    await sessionInput.fill('hello from playwright');
    await page.getByTestId('terminal-session-send').click();

    await expect(page.getByTestId('terminal-session-output')).toContainText(
      'hello from playwright',
      {
        timeout: 10000
      }
    );

    await page.getByTestId('terminal-session-stop').click();

    await expect(lastStatus).toContainText('stopped', { timeout: 10000 });
    await expect(page.getByTestId('run-drawer-status')).toContainText('stopped', {
      timeout: 10000
    });
    await expect(page.getByTestId('terminal-session-state')).toContainText('Session stopped');
  } finally {
    await app.close();
  }
});
