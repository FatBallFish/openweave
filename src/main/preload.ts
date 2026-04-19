import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type OpenWeaveShellBridge } from '../shared/ipc/contracts';
import type {
  CanvasLoadInput,
  CanvasSaveInput,
  ComponentInstallInput,
  ComponentListInput,
  ComponentUninstallInput,
  FileTreeLoadInput,
  GraphLoadV2Input,
  GraphSaveV2Input,
  PortalCaptureInput,
  PortalClickInput,
  PortalInputInput,
  PortalLoadInput,
  PortalStructureInput,
  RunGetInput,
  RunInputInput,
  RunListInput,
  RunStartInput,
  RunStopInput,
  WorkspaceBranchCreateInput,
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
    createBranchWorkspace: (input: WorkspaceBranchCreateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceCreateBranch, input),
    listWorkspaces: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceList),
    openWorkspace: (input: WorkspaceOpenInput) => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen, input),
    deleteWorkspace: (input: WorkspaceDeleteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceDelete, input)
  },
  components: {
    listComponents: (input: ComponentListInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.componentList, input),
    installComponent: (input: ComponentInstallInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.componentInstall, input),
    uninstallComponent: (input: ComponentUninstallInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.componentUninstall, input)
  },
  canvas: {
    loadCanvasState: (input: CanvasLoadInput) => ipcRenderer.invoke(IPC_CHANNELS.canvasLoad, input),
    saveCanvasState: (input: CanvasSaveInput) => ipcRenderer.invoke(IPC_CHANNELS.canvasSave, input)
  },
  graph: {
    loadGraphSnapshot: (input: GraphLoadV2Input) => ipcRenderer.invoke(IPC_CHANNELS.graphLoad, input),
    saveGraphSnapshot: (input: GraphSaveV2Input) => ipcRenderer.invoke(IPC_CHANNELS.graphSave, input)
  },
  runs: {
    startRun: (input: RunStartInput) => ipcRenderer.invoke(IPC_CHANNELS.runStart, input),
    getRun: (input: RunGetInput) => ipcRenderer.invoke(IPC_CHANNELS.runGet, input),
    listRuns: (input: RunListInput) => ipcRenderer.invoke(IPC_CHANNELS.runList, input),
    inputRun: (input: RunInputInput) => ipcRenderer.invoke(IPC_CHANNELS.runInput, input),
    stopRun: (input: RunStopInput) => ipcRenderer.invoke(IPC_CHANNELS.runStop, input)
  },
  files: {
    loadFileTree: (input: FileTreeLoadInput) => ipcRenderer.invoke(IPC_CHANNELS.fileTreeLoad, input)
  },
  portal: {
    loadPortal: (input: PortalLoadInput) => ipcRenderer.invoke(IPC_CHANNELS.portalLoad, input),
    capturePortalScreenshot: (input: PortalCaptureInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.portalCapture, input),
    readPortalStructure: (input: PortalStructureInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.portalReadStructure, input),
    clickPortalElement: (input: PortalClickInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.portalClick, input),
    inputPortalText: (input: PortalInputInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.portalInput, input)
  }
};

contextBridge.exposeInMainWorld('openweaveShell', shellBridge);
