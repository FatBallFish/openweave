import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

const shellMarker = '/dist/renderer/index.html';

export async function launchPortalShell(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['dist/main/main.js'],
    cwd: process.cwd(),
  });

  const page = await waitForShellPage(app);
  return { app, page };
}

async function waitForShellPage(app: ElectronApplication): Promise<Page> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    for (const page of app.windows()) {
      if (page.url().includes(shellMarker)) {
        await page.waitForLoadState('domcontentloaded');
        return page;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error('Portal shell window did not appear');
}
