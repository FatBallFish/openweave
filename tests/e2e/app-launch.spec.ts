import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('opens the Electron workbench shell', async () => {
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-app-launch-${uniqueSuffix}`);
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
    await expect(page.getByTestId('workbench-topbar')).toBeVisible();
    await expect(page.getByTestId('workbench-overlay-stage')).toBeVisible();
    await expect(page.getByTestId('workbench-stage')).toBeVisible();
    await expect(page.getByTestId('workbench-context-panel')).toBeVisible();
    await expect(page.getByTestId('workbench-inspector')).toBeVisible();

    await page.getByTestId('workbench-inspector-toggle').click();
    await expect(page.getByTestId('workbench-inspector-expand-trigger')).toBeVisible();

    const bridge = await page.evaluate(() => {
      const shell = (window as Window & { openweaveShell?: unknown }).openweaveShell as
        | { platform?: unknown; ipcChannels?: Record<string, unknown> }
        | undefined;

      return {
        exists: typeof shell === 'object' && shell !== null,
        platformType: typeof shell?.platform,
        platform: shell?.platform,
        workspaceCreateChannelType: typeof shell?.ipcChannels?.workspaceCreate
      };
    });

    expect(bridge.exists).toBe(true);
    expect(bridge.platformType).toBe('string');
    expect(['darwin', 'linux', 'win32']).toContain(bridge.platform);
    expect(bridge.workspaceCreateChannelType).toBe('string');
  } finally {
    await app.close();
  }
});
