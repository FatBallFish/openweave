import { app, BrowserWindow, ipcMain } from 'electron';
import http from 'node:http';
import path from 'node:path';
import { PortalManager } from './main/portal-manager';
import type { PortalBounds, PortalDefinition } from './shared/portal-contract';

let mainWindow: BrowserWindow | null = null;
let portalManager: PortalManager | null = null;
let fixtureServer: http.Server | null = null;

async function startPortalFixtureServer(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((request, response) => {
    const palette = request.url?.includes('portal-b')
      ? { shell: '#123f55', accent: '#7ee0cb', label: 'Portal B' }
      : { shell: '#4f2e18', accent: '#ffd3a5', label: 'Portal A' };

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${palette.label}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top left, ${palette.accent}, transparent 35%), ${palette.shell};
        color: white;
        font-family: Helvetica, Arial, sans-serif;
      }
      .card {
        width: min(78vw, 560px);
        padding: 28px;
        border-radius: 28px;
        border: 1px solid rgba(255,255,255,0.24);
        background: rgba(255,255,255,0.12);
        box-shadow: 0 24px 90px rgba(0, 0, 0, 0.26);
      }
      h1 { margin: 0 0 12px; }
      p { margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <section class="card">
      <h1>${palette.label}</h1>
      <p>Local fixture served from ${request.url}</p>
    </section>
  </body>
</html>`);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve fixture server port');
  }

  return { server, port: address.port };
}

function buildPortals(port: number): PortalDefinition[] {
  return [
    {
      id: 'portal-a',
      label: 'Portal A',
      url: `http://127.0.0.1:${port}/portal-a`,
    },
    {
      id: 'portal-b',
      label: 'Portal B',
      url: `http://127.0.0.1:${port}/portal-b`,
    },
  ];
}

function emitSnapshot() {
  if (!mainWindow || !portalManager) {
    return;
  }

  mainWindow.webContents.send('portal:snapshot', portalManager['bootstrap' as never] ? undefined : undefined);
}

async function createWindow() {
  const fixture = await startPortalFixtureServer();
  fixtureServer = fixture.server;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#f6f1e8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const portals = buildPortals(fixture.port);
  portalManager = new PortalManager(mainWindow, portals, (snapshot) => {
    mainWindow?.webContents.send('portal:snapshot', snapshot);
  });

  ipcMain.handle('portal:bootstrap', async () => portalManager?.bootstrap());
  ipcMain.handle('portal:activate', async (_event, portalId: string) => portalManager?.setActivePortal(portalId));
  ipcMain.handle('portal:set-zoom', async (_event, zoom: number) => portalManager?.setZoom(zoom));
  ipcMain.handle('portal:sync-bounds', async (_event, payload: { portalId: string; bounds: PortalBounds }) =>
    portalManager?.syncPortalBounds(payload.portalId, payload.bounds),
  );

  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

void app.whenReady().then(() => {
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', () => {
  fixtureServer?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
