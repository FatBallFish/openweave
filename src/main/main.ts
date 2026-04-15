import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerWorkspaceIpcHandlers } from './ipc/workspaces';

const createMainWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const rendererEntry = path.join(__dirname, '..', 'renderer', 'index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  void mainWindow.loadFile(rendererEntry);

  return mainWindow;
};

void app.whenReady().then(() => {
  registerWorkspaceIpcHandlers(path.join(app.getPath('userData'), 'registry.db'));
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
