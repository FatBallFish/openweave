import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type OpenWeaveShellBridge, type RunStreamEvent } from '../shared/ipc/contracts';

ipcRenderer.on(IPC_CHANNELS.appOpenSettings, () => {
  window.dispatchEvent(new CustomEvent('openweave:open-settings'));
});
import type {
  CanvasLoadInput,
  CanvasSaveInput,
  ComponentInstallInput,
  ComponentListInput,
  ComponentUninstallInput,
  FileTreeLoadInput,
  GraphLoadV2Input,
  GraphSaveV2Input,
  NoteFileCreateInput,
  NoteFileDeleteInput,
  NoteFileReadInput,
  NoteFileRenameInput,
  NoteFileWriteInput,
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
  WorkspaceGroupCollapseSetInput,
  WorkspaceGroupCreateInput,
  WorkspaceGroupDeleteInput,
  WorkspaceGroupMoveInput,
  WorkspaceGroupMoveToUngroupedInput,
  WorkspaceGroupReorderGroupsInput,
  WorkspaceGroupReorderUngroupedInput,
  WorkspaceGroupReorderWithinGroupInput,
  WorkspaceGroupUpdateInput,
  WorkspaceOpenInput,
  WorkspacePickDirectoryInput,
  WorkspaceRevealDirectoryInput,
  WorkspaceUpdateInput
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
      ipcRenderer.invoke(IPC_CHANNELS.workspaceDelete, input),
    updateWorkspace: (input: WorkspaceUpdateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceUpdate, input),
    listWorkspaceGroups: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceGroupList),
    createWorkspaceGroup: (input: WorkspaceGroupCreateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceGroupCreate, input),
    updateWorkspaceGroup: (input: WorkspaceGroupUpdateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceGroupUpdate, input),
    deleteWorkspaceGroup: (input: WorkspaceGroupDeleteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceGroupDelete, input),
    setWorkspaceGroupCollapsed: (input: WorkspaceGroupCollapseSetInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceGroupCollapseSet, input),
    moveWorkspaceToGroup: (input: WorkspaceGroupMoveInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceMoveToGroup, input),
    moveWorkspaceToUngrouped: (input: WorkspaceGroupMoveToUngroupedInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceMoveToUngrouped, input),
    reorderUngroupedWorkspaces: (input: WorkspaceGroupReorderUngroupedInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceReorderUngrouped, input),
    reorderWorkspaceGroups: (input: WorkspaceGroupReorderGroupsInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceReorderGroups, input),
    reorderGroupMembers: (input: WorkspaceGroupReorderWithinGroupInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceReorderGroupMembers, input),
    pickWorkspaceDirectory: (input: WorkspacePickDirectoryInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspacePickDirectory, input),
    revealWorkspaceDirectory: (input: WorkspaceRevealDirectoryInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceRevealDirectory, input)
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
    stopRun: (input: RunStopInput) => ipcRenderer.invoke(IPC_CHANNELS.runStop, input),
    subscribeStream: (runId: string) => ipcRenderer.send(IPC_CHANNELS.runStreamSubscribe, { runId }),
    unsubscribeStream: (runId: string) => ipcRenderer.send(IPC_CHANNELS.runStreamUnsubscribe, { runId }),
    onStream: (callback: (event: RunStreamEvent) => void) => {
      const handler = (_event: unknown, data: RunStreamEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.runStream, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.runStream, handler);
    },
    resizeRun: (input: { runId: string; cols: number; rows: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.runResize, input)
  },
  roles: {
    listRoles: () => ipcRenderer.invoke(IPC_CHANNELS.roleList),
    createRole: (input: { name: string; description: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.roleCreate, input),
    updateRole: (input: { id: string; name?: string; description?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.roleUpdate, input),
    deleteRole: (input: { id: string }) => ipcRenderer.invoke(IPC_CHANNELS.roleDelete, input)
  },
  notes: {
    createFile: (input: NoteFileCreateInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.noteFileCreate, input),
    readFile: (input: NoteFileReadInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.noteFileRead, input),
    writeFile: (input: NoteFileWriteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.noteFileWrite, input),
    deleteFile: (input: NoteFileDeleteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.noteFileDelete, input),
    renameFile: (input: NoteFileRenameInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.noteFileRename, input)
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
  },
  app: {
    openSettings: () => ipcRenderer.invoke(IPC_CHANNELS.appOpenSettings)
  }
};

contextBridge.exposeInMainWorld('openweaveShell', shellBridge);
