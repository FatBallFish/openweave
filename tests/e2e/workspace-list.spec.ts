import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('supports create/open/delete from the workspace list page', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-workspace-list-${uniqueSuffix}`);
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  const workspaceName = `Workspace-${uniqueSuffix}`;
  const workspaceRoot = path.join(os.tmpdir(), `openweave-${uniqueSuffix}`);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  try {
    const page = await app.firstWindow();

    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    const workspaceRow = page.locator('[data-testid^="workspace-row-"]').filter({
      has: page.getByText(workspaceName, { exact: true })
    });

    await expect(workspaceRow).toBeVisible();
    await expect(workspaceRow.getByText(workspaceRoot)).toBeVisible();

    await page.getByRole('button', { name: `Open ${workspaceName}` }).click();
    await expect(page.getByTestId('active-workspace-name')).toContainText(workspaceName);

    await page.getByRole('button', { name: `Delete ${workspaceName}` }).click();
    await expect(workspaceRow).toHaveCount(0);
  } finally {
    await app.close();
  }
});
