import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

const startPortalFixtureServer = async (): Promise<{
  origin: string;
  close: () => Promise<void>;
}> => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Portal Fixture</title>
  </head>
  <body>
    <h1>Portal Fixture</h1>
    <input id="message-input" type="text" value="" />
    <button id="action-button" type="button">Run action</button>
    <p id="result">idle</p>
    <script>
      const input = document.getElementById('message-input');
      const button = document.getElementById('action-button');
      const result = document.getElementById('result');
      input.addEventListener('input', () => {
        result.textContent = 'input:' + input.value;
      });
      button.addEventListener('click', () => {
        result.textContent = 'clicked:' + input.value;
      });
    </script>
  </body>
</html>`);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve fixture server address');
  }

  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
};

test('loads portal url and supports click/input/capture/structure with file:// rejection', async () => {
  const fixture = await startPortalFixtureServer();
  const uniqueSuffix = Date.now().toString();
  const userDataDir = path.join(os.tmpdir(), `openweave-e2e-portal-${uniqueSuffix}`);
  const workspaceName = `Portal-${uniqueSuffix}`;
  const workspaceRoot = `/tmp/openweave-portal-${uniqueSuffix}`;

  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist/main/main.js')],
    env: {
      ...process.env,
      OPENWEAVE_USER_DATA_DIR: userDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('workspace-list-page')).toBeVisible();

    await page.getByTestId('workspace-create-button').click();
    await page.getByTestId('create-workspace-name-input').fill(workspaceName);
    await page.getByTestId('create-workspace-root-input').fill(workspaceRoot);
    await page.getByTestId('create-workspace-submit').click();

    await expect(page.getByTestId('workspace-canvas-page')).toBeVisible();
    await page.getByTestId('canvas-add-portal').click();

    const urlInput = page.locator('[data-testid^="portal-url-input-"]').first();
    const loadButton = page.locator('[data-testid^="portal-load-"]').first();
    const inputValueField = page.locator('[data-testid^="portal-input-value-"]').first();
    const inputButton = page.locator('button[data-testid^="portal-input-"]').first();
    const clickButton = page.locator('button[data-testid^="portal-click-"]').first();
    const captureButton = page.locator('button[data-testid^="portal-capture-"]').first();
    const structureButton = page.locator('button[data-testid^="portal-structure-"]').first();
    const actionStatus = page.locator('[data-testid^="portal-action-status-"]').first();
    const screenshotPath = page.locator('[data-testid^="portal-screenshot-path-"]').first();
    const structureList = page.locator('[data-testid^="portal-structure-list-"]').first();
    const errorMessage = page.locator('[data-testid^="portal-error-"]').first();

    await urlInput.fill(fixture.origin);
    await loadButton.click();
    await expect(actionStatus).toContainText('Loaded portal URL', { timeout: 10000 });

    await inputValueField.fill('hello portal');
    await inputButton.click();
    await expect(actionStatus).toContainText('Input applied', { timeout: 10000 });

    await clickButton.click();
    await expect(actionStatus).toContainText('Clicked element', { timeout: 10000 });

    await captureButton.click();
    await expect(screenshotPath).toContainText('artifacts/portal/');

    await structureButton.click();
    await expect(structureList).toContainText('button:');
    await expect(structureList).toContainText('input:');

    await urlInput.fill('file:///tmp/demo.html');
    await loadButton.click();
    await expect(errorMessage).toContainText('URL scheme not allowed');
  } finally {
    await app.close();
    await fixture.close();
  }
});
