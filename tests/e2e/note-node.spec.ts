import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('persists note node content and position across restart', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-note-node-${uniqueSuffix}`);
  const workspaceName = `Canvas-${uniqueSuffix}`;
  const workspaceRoot = `/tmp/openweave-canvas-${uniqueSuffix}`;

  const firstApp = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const firstPage = await firstApp.firstWindow();

    await expect(firstPage.getByTestId('workspace-list-page')).toBeVisible();
    await firstPage.getByTestId('workspace-create-button').click();
    await firstPage.getByTestId('create-workspace-name-input').fill(workspaceName);
    await firstPage.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await firstPage.getByTestId('create-workspace-submit').click();

    await expect(firstPage.getByTestId('workspace-canvas-page')).toBeVisible();
    await firstPage.getByTestId('canvas-add-note').click();

    const noteContent = firstPage.locator('[data-testid^="note-node-content-"]').first();
    const noteX = firstPage.locator('[data-testid^="note-node-x-"]').first();
    const noteY = firstPage.locator('[data-testid^="note-node-y-"]').first();

    await noteContent.fill('# Hello');
    await noteX.fill('120');
    await noteY.fill('80');

    await expect(noteContent).toHaveValue('# Hello');
    await expect(noteX).toHaveValue('120');
    await expect(noteY).toHaveValue('80');
  } finally {
    await firstApp.close();
  }

  const secondApp = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const secondPage = await secondApp.firstWindow();
    await expect(secondPage.getByTestId('workspace-list-page')).toBeVisible();
    await secondPage.getByRole('button', { name: `Open ${workspaceName}` }).click();
    await expect(secondPage.getByTestId('workspace-canvas-page')).toBeVisible();

    const restoredContent = secondPage.locator('[data-testid^="note-node-content-"]').first();
    const restoredX = secondPage.locator('[data-testid^="note-node-x-"]').first();
    const restoredY = secondPage.locator('[data-testid^="note-node-y-"]').first();

    await expect(restoredContent).toHaveValue('# Hello');
    await expect(restoredX).toHaveValue('120');
    await expect(restoredY).toHaveValue('80');
  } finally {
    await secondApp.close();
  }
});
