import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import {
  disposeCanvasIpcHandlers,
  disposeCanvasWorkspaceRepository,
  registerCanvasIpcHandlers
} from './ipc/canvas';
import { disposeFilesIpcHandlers, registerFilesIpcHandlers } from './ipc/files';
import {
  disposePortalIpcHandlers,
  disposePortalWorkspaceState,
  registerPortalIpcHandlers
} from './ipc/portal';
import {
  disposeRunsForWorkspace,
  disposeRunsIpcHandlers,
  recoverRunsForWorkspace,
  registerRunsIpcHandlers
} from './ipc/runs';
import { disposeWorkspaceIpcHandlers, registerWorkspaceIpcHandlers } from './ipc/workspaces';

const configuredUserDataDir = process.env.OPENWEAVE_USER_DATA_DIR;
if (configuredUserDataDir) {
  app.setPath('userData', path.resolve(configuredUserDataDir));
}

const CRASH_RECOVERY_MARKER_FILE = 'unclean-shutdown.marker';
let crashRecoveryMarkerPath: string | null = null;

const initializeCrashRecoveryMarker = (): boolean => {
  const markerPath = path.join(app.getPath('userData'), CRASH_RECOVERY_MARKER_FILE);
  crashRecoveryMarkerPath = markerPath;

  const shouldRecoverRuns = fs.existsSync(markerPath);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, String(Date.now()));
  return shouldRecoverRuns;
};

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
  const enableCrashRecoveryOnOpen = initializeCrashRecoveryMarker();

  registerWorkspaceIpcHandlers({
    dbFilePath: registryDbFilePath,
    onWorkspaceOpened: (workspaceId: string) => {
      recoverRunsForWorkspace(workspaceId);
    },
    onWorkspaceDeleted: (workspaceId: string) => {
      disposeCanvasWorkspaceRepository(workspaceId);
      disposeRunsForWorkspace(workspaceId);
      disposePortalWorkspaceState(workspaceId);
    }
  });
  registerCanvasIpcHandlers({
    workspaceDbDir: path.join(app.getPath('userData'), 'workspaces'),
    registryDbFilePath
  });
  registerRunsIpcHandlers({
    dbFilePath: registryDbFilePath,
    workspaceDbDir: path.join(app.getPath('userData'), 'workspaces'),
    enableCrashRecoveryOnOpen
  });
  registerFilesIpcHandlers({
    dbFilePath: registryDbFilePath
  });
  registerPortalIpcHandlers({
    dbFilePath: registryDbFilePath,
    artifactsRootDir: path.join(app.getPath('userData'), 'artifacts', 'portal')
  });
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
  if (crashRecoveryMarkerPath) {
    try {
      fs.rmSync(crashRecoveryMarkerPath, { force: true });
    } catch {
      // Keep shutdown best-effort; marker cleanup failure should not block exit.
    }
  }
  disposeFilesIpcHandlers();
  disposePortalIpcHandlers();
  disposeRunsIpcHandlers();
  disposeCanvasIpcHandlers();
  disposeWorkspaceIpcHandlers();
});
