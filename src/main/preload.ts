import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type OpenWeaveShellBridge } from '../shared/ipc/contracts';
import type {
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
  }
};

contextBridge.exposeInMainWorld('openweaveShell', shellBridge);
