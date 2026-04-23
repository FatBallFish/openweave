import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import {
  cleanupRegisteredBranchWorkspaceOnDelete,
  disposeBranchWorkspaceIpcHandlers,
  registerBranchWorkspaceIpcHandlers
} from './ipc/branch-workspaces';
import {
  disposeCanvasIpcHandlers,
  disposeCanvasWorkspaceRepository,
  registerCanvasIpcHandlers
} from './ipc/canvas';
import { disposeComponentsIpcHandlers, registerComponentsIpcHandlers } from './ipc/components';
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
import { disposeRolesIpcHandlers, registerRolesIpcHandlers } from './ipc/roles';
import { createRegistryRepository } from './db/registry';
import { IPC_CHANNELS } from '../shared/ipc/contracts';

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
    width: 1440,
    minWidth: 1280,
    height: 860,
    minHeight: 760,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.OPENWEAVE_DEV_URL;
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    const rendererEntry = path.join(__dirname, '..', 'renderer', 'index.html');
    void mainWindow.loadFile(rendererEntry);
  }

  return mainWindow;
};

void app.whenReady().then(() => {
  const registryDbFilePath = path.join(app.getPath('userData'), 'registry.db');
  const workspaceDbDir = path.join(app.getPath('userData'), 'workspaces');
  const enableCrashRecoveryOnOpen = initializeCrashRecoveryMarker();

  ipcMain.handle(IPC_CHANNELS.appOpenSettings, () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.appOpenSettings);
    }
  });

  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences...',
                accelerator: 'Command+,',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow();
                  if (win) {
                    win.webContents.send(IPC_CHANNELS.appOpenSettings);
                  }
                }
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const }
            ]
          : [])
      ]
    }
  ];

  if (!isMac) {
    template.push({
      label: 'Settings',
      submenu: [
        {
          label: 'Preferences...',
          accelerator: 'Shift+Alt+,',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send(IPC_CHANNELS.appOpenSettings);
            }
          }
        }
      ]
    } as Electron.MenuItemConstructorOptions);
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  registerBranchWorkspaceIpcHandlers({
    dbFilePath: registryDbFilePath,
    workspaceDbDir
  });
  registerWorkspaceIpcHandlers({
    dbFilePath: registryDbFilePath,
    onWorkspaceOpened: (workspaceId: string) => {
      recoverRunsForWorkspace(workspaceId);
    },
    onWorkspaceDeleting: async (workspace) => {
      await cleanupRegisteredBranchWorkspaceOnDelete(workspace);
    },
    onWorkspaceDeleted: (workspaceId: string) => {
      disposeCanvasWorkspaceRepository(workspaceId);
      disposeRunsForWorkspace(workspaceId);
      disposePortalWorkspaceState(workspaceId);
    }
  });
  registerCanvasIpcHandlers({
    workspaceDbDir,
    registryDbFilePath
  });
  registerComponentsIpcHandlers({
    dbFilePath: registryDbFilePath,
    installRoot: path.join(app.getPath('userData'), 'components'),
    appVersion: app.getVersion()
  });
  registerRunsIpcHandlers({
    dbFilePath: registryDbFilePath,
    workspaceDbDir,
    enableCrashRecoveryOnOpen
  });
  registerFilesIpcHandlers({
    dbFilePath: registryDbFilePath
  });
  registerPortalIpcHandlers({
    dbFilePath: registryDbFilePath,
    artifactsRootDir: path.join(app.getPath('userData'), 'artifacts', 'portal')
  });
  registerRolesIpcHandlers({ registry: createRegistryRepository({ dbFilePath: registryDbFilePath }) });
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
  disposeComponentsIpcHandlers();
  disposePortalIpcHandlers();
  disposeRunsIpcHandlers();
  disposeBranchWorkspaceIpcHandlers();
  disposeCanvasIpcHandlers();
  disposeWorkspaceIpcHandlers();
  disposeRolesIpcHandlers();
});
