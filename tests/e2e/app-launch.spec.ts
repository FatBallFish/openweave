import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

test('opens the Electron shell entry page', async () => {
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')]
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('app-shell-title')).toHaveText('OpenWeave');
    await expect(page.getByTestId('app-shell-subtitle')).toContainText('Electron shell ready');
  } finally {
    await app.close();
  }
});
