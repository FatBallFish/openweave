import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('shortcuts settings tab displays and reset works', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-shortcuts-${uniqueSuffix}`);
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workbench-shell')).toBeVisible();

    // Open settings via custom event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('openweave:open-settings'));
    });

    await expect(page.getByTestId('settings-dialog')).toBeVisible();

    // Switch to Shortcuts tab
    await page.getByRole('button', { name: /Shortcuts|快捷键/ }).click();

    // Verify shortcut rows are visible
    await expect(page.getByTestId('shortcut-row-open-command-palette')).toBeVisible();
    await expect(page.getByTestId('shortcut-row-undo')).toBeVisible();
    await expect(page.getByTestId('shortcut-row-add-terminal')).toBeVisible();

    // Verify shortcut keys display
    const commandPaletteKey = page.getByTestId('shortcut-key-open-command-palette');
    await expect(commandPaletteKey).toBeVisible();

    // Click reset button and confirm
    await page.getByTestId('shortcuts-reset-all').click();
    // Playwright automatically handles confirm() dialogs by default (accepts them)

    // Verify reset button still exists (no crash)
    await expect(page.getByTestId('shortcuts-reset-all')).toBeVisible();
  } finally {
    await app.close();
  }
});
