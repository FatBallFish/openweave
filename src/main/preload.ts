import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type OpenWeaveShellBridge } from '../shared/ipc/contracts';
import type {
  CanvasLoadInput,
  CanvasSaveInput,
  FileTreeLoadInput,
  RunGetInput,
  RunListInput,
  RunStartInput,
  WorkspaceCreateInput,
  WorkspaceDeleteInput,
  WorkspaceOpenInput
} from '../shared/ipc/schemas';

const shellBridge: OpenWeaveShellBridge = {
  platform: process.platform,
  ipcChannels: IPC_CHANNELS,
  workspaces: {
    createWorkspace: (input: WorkspaceCreateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceCreate, input),
    listWorkspaces: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceList),
    openWorkspace: (input: WorkspaceOpenInput) => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen, input),
    deleteWorkspace: (input: WorkspaceDeleteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceDelete, input)
  },
  canvas: {
    loadCanvasState: (input: CanvasLoadInput) => ipcRenderer.invoke(IPC_CHANNELS.canvasLoad, input),
    saveCanvasState: (input: CanvasSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.canvasSave, input)
  },
  runs: {
    startRun: (input: RunStartInput) => ipcRenderer.invoke(IPC_CHANNELS.runStart, input),
    getRun: (input: RunGetInput) => ipcRenderer.invoke(IPC_CHANNELS.runGet, input),
    listRuns: (input: RunListInput) => ipcRenderer.invoke(IPC_CHANNELS.runList, input)
  },
  files: {
    loadFileTree: (input: FileTreeLoadInput) => ipcRenderer.invoke(IPC_CHANNELS.fileTreeLoad, input)
  }
};

contextBridge.exposeInMainWorld('openweaveShell', shellBridge);
