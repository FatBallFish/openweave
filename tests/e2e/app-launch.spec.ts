import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('opens the Electron shell entry page', async () => {
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
    await expect(page.getByTestId('app-shell-title')).toHaveText('OpenWeave');
    await expect(page.getByTestId('app-shell-subtitle')).toContainText('Electron shell ready');

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
