import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import {
  disposeCanvasIpcHandlers,
  disposeCanvasWorkspaceRepository,
  registerCanvasIpcHandlers
} from './ipc/canvas';
import { registerFilesIpcHandlers } from './ipc/files';
import { disposeRunsForWorkspace, disposeRunsIpcHandlers, registerRunsIpcHandlers } from './ipc/runs';
import { disposeWorkspaceIpcHandlers, registerWorkspaceIpcHandlers } from './ipc/workspaces';

const configuredUserDataDir = process.env.OPENWEAVE_USER_DATA_DIR;
if (configuredUserDataDir) {
  app.setPath('userData', path.resolve(configuredUserDataDir));
}

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
  const registryDbFilePath = path.join(app.getPath('userData'), 'registry.db');
  registerWorkspaceIpcHandlers({
    dbFilePath: registryDbFilePath,
    onWorkspaceDeleted: (workspaceId: string) => {
      disposeCanvasWorkspaceRepository(workspaceId);
      disposeRunsForWorkspace(workspaceId);
    }
  });
  registerCanvasIpcHandlers({
    workspaceDbDir: path.join(app.getPath('userData'), 'workspaces'),
    registryDbFilePath
  });
  registerRunsIpcHandlers({
    dbFilePath: registryDbFilePath
  });
  registerFilesIpcHandlers();
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

app.on('will-quit', () => {
  disposeRunsIpcHandlers();
  disposeCanvasIpcHandlers();
  disposeWorkspaceIpcHandlers();
});
