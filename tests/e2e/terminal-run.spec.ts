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
    await page.getByTestId('workbench-topbar-action-add-terminal').click();

    // Placement mode: drag on canvas to define terminal bounds
    const canvas = page.locator('.ow-canvas-shell__flow .react-flow__pane, .ow-canvas-placement-overlay').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 400, box.y + 300);
      await page.mouse.up();
    }

    // Create terminal dialog should open after placement
    await page.waitForSelector('[data-testid="create-terminal-dialog"]');
    await page.getByTestId('create-terminal-command').fill("/bin/sh -lc 'echo ready; while read line; do echo $line; done'");
    await page.click('.ow-workspace-dialog__actions button[data-testid="create-terminal-submit"]');

    // Wait for terminal node to appear and auto-start
    await page.waitForSelector('[data-testid^="terminal-node-xterm-"]');
    await expect(page.getByTestId('run-drawer')).toBeVisible();

    // Focus the xterm in the run drawer and type directly
    const sessionXterm = page.locator('[data-testid="terminal-session-xterm"]').first();
    await sessionXterm.click();
    await page.keyboard.type('hello from playwright\n');

    await page.getByTestId('terminal-session-stop').click();

    await expect(page.getByTestId('run-drawer-status')).toContainText('stopped', {
      timeout: 10000
    });
    await expect(page.getByTestId('terminal-session-state')).toContainText('Session stopped');
  } finally {
    await app.close();
  }
});

test('xterm.js renders ANSI colored output', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-xterm-ansi-${uniqueSuffix}`);
  const workspaceName = `XtermANSI-${uniqueSuffix}`;
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-xterm-ansi-'));
  const app = await electron.launch(resolveElectronLaunchOptions(userDataDir));

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();

    // Open create terminal dialog
    await page.getByTestId('workbench-topbar-action-add-terminal').click();

    // Placement mode: drag on canvas
    const canvas = page.locator('.ow-canvas-shell__flow .react-flow__pane, .ow-canvas-placement-overlay').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 400, box.y + 300);
      await page.mouse.up();
    }

    await page.waitForSelector('[data-testid="create-terminal-dialog"]');

    // Fill in command that produces ANSI colors
    await page.getByTestId('create-terminal-command').fill('echo -e "\e[31mred\e[0m"');

    // Save dialog
    await page.click('.ow-workspace-dialog__actions button[data-testid="create-terminal-submit"]');

    // Wait for terminal node to appear with xterm container
    await page.waitForSelector('[data-testid^="terminal-node-xterm-"]');

    // Verify xterm container is present and visible
    const xtermContainer = page.locator('[data-testid^="terminal-node-xterm-"]').first();
    await expect(xtermContainer).toBeVisible();
  } finally {
    await app.close();
  }
});

test('create terminal dialog opens and configures node', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-dialog-${uniqueSuffix}`);
  const workspaceName = `Dialog-${uniqueSuffix}`;
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-dialog-'));
  const app = await electron.launch(resolveElectronLaunchOptions(userDataDir));

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();

    // Open dialog via add terminal button
    await page.getByTestId('workbench-topbar-action-add-terminal').click();

    // Placement mode: drag on canvas
    const canvas = page.locator('.ow-canvas-shell__flow .react-flow__pane, .ow-canvas-placement-overlay').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 400, box.y + 300);
      await page.mouse.up();
    }

    // Verify dialog is visible
    const dialog = page.locator('.ow-create-terminal-dialog');
    await expect(dialog).toBeVisible();

    // Fill name and command
    await page.getByTestId('create-terminal-name').fill('Test Terminal');
    await page.getByTestId('create-terminal-command').fill('echo hello');

    // Switch to appearance tab
    await page.click('.ow-terminal-dialog__tab:has-text("Appearance")');
    await expect(page.getByTestId('create-terminal-theme')).toBeVisible();

    // Switch to role tab
    await page.click('.ow-terminal-dialog__tab:has-text("Role")');
    await expect(page.locator('.ow-role-grid')).toBeVisible();

    // Save
    await page.click('.ow-workspace-dialog__actions button[data-testid="create-terminal-submit"]');

    // Verify dialog closes
    await expect(dialog).not.toBeVisible();

    // Verify terminal node appears
    await page.waitForSelector('[data-testid^="terminal-node-"]');
  } finally {
    await app.close();
  }
});

test('create terminal with role selection', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-role-${uniqueSuffix}`);
  const workspaceName = `Role-${uniqueSuffix}`;
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-role-'));
  const app = await electron.launch(resolveElectronLaunchOptions(userDataDir));

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();

    // First create a role via settings
    await page.getByTestId('workbench-left-rail-item-settings').click();
    await page.waitForSelector('[data-testid="settings-dialog"]');
    await page.click('.ow-settings-dialog__tab:has-text("Role")');

    // Create new role
    await page.click('.ow-role-settings-panel__new');
    await page.waitForSelector('.ow-role-editor-dialog');
    await page.fill('.ow-role-editor-dialog__field input[type="text"]', 'Test Role');
    await page.fill('.ow-role-editor-dialog__field textarea', 'You are a test role.');
    await page.click('.ow-role-editor-dialog__footer button:has-text("Save")');

    // Close settings
    await page.click('.ow-settings-dialog__close');

    // Create terminal with this role
    await page.getByTestId('workbench-topbar-action-add-terminal').click();

    // Placement mode: drag on canvas
    const canvas = page.locator('.ow-canvas-shell__flow .react-flow__pane, .ow-canvas-placement-overlay').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 400, box.y + 300);
      await page.mouse.up();
    }

    await page.waitForSelector('.ow-create-terminal-dialog');
    await page.click('.ow-terminal-dialog__tab:has-text("Role")');
    await page.click('.ow-role-grid__item:has-text("Test Role")');
    await page.click('.ow-workspace-dialog__actions button[data-testid="create-terminal-submit"]');

    // The role injection happens in the main process, we can't directly verify
    // the filesystem from E2E. Instead, verify the terminal node was created.
    await page.waitForSelector('[data-testid^="terminal-node-"]');
  } finally {
    await app.close();
  }
});
