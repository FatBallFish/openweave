import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type OpenWeaveShellBridge } from '../shared/ipc/contracts';
import type {
  WorkspaceCreateInput,
  WorkspaceDeleteInput,
  WorkspaceOpenInput
} from '../shared/ipc/schemas';

const detectPlatform = (): string => {
  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) {
      return 'darwin';
    }
    if (ua.includes('win')) {
      return 'win32';
    }
    if (ua.includes('linux')) {
      return 'linux';
    }
  }
  return 'unknown';
};

const shellBridge: OpenWeaveShellBridge = {
  platform: detectPlatform(),
  ipcChannels: IPC_CHANNELS,
  workspaces: {
    createWorkspace: (input: WorkspaceCreateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceCreate, input),
    listWorkspaces: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceList),
    openWorkspace: (input: WorkspaceOpenInput) => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen, input),
    deleteWorkspace: (input: WorkspaceDeleteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceDelete, input)
  }
};

contextBridge.exposeInMainWorld('openweaveShell', shellBridge);
