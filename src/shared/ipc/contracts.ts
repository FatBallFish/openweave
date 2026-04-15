import type {
  CanvasLoadInput,
  CanvasSaveInput,
  CanvasStateInput,
  WorkspaceCreateInput,
  WorkspaceDeleteInput,
  WorkspaceOpenInput
} from './schemas';

export const IPC_CHANNELS = {
  workspaceCreate: 'workspace:create',
  workspaceList: 'workspace:list',
  workspaceOpen: 'workspace:open',
  workspaceDelete: 'workspace:delete',
  canvasLoad: 'canvas:load',
  canvasSave: 'canvas:save'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface WorkspaceRecord {
  id: string;
  name: string;
  rootDir: string;
  createdAtMs: number;
  updatedAtMs: number;
  lastOpenedAtMs: number | null;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceRecord[];
}

export interface WorkspaceMutationResponse {
  workspace: WorkspaceRecord;
}

export interface WorkspaceDeleteResponse {
  deleted: boolean;
}

export interface CanvasLoadResponse {
  state: CanvasStateInput;
}

export interface CanvasSaveResponse {
  state: CanvasStateInput;
}

export interface WorkspaceBridgeApi {
  createWorkspace: (input: WorkspaceCreateInput) => Promise<WorkspaceMutationResponse>;
  listWorkspaces: () => Promise<WorkspaceListResponse>;
  openWorkspace: (input: WorkspaceOpenInput) => Promise<WorkspaceMutationResponse>;
  deleteWorkspace: (input: WorkspaceDeleteInput) => Promise<WorkspaceDeleteResponse>;
}

export interface CanvasBridgeApi {
  loadCanvasState: (input: CanvasLoadInput) => Promise<CanvasLoadResponse>;
  saveCanvasState: (input: CanvasSaveInput) => Promise<CanvasSaveResponse>;
}

export interface OpenWeaveShellBridge {
  platform: string;
  ipcChannels: typeof IPC_CHANNELS;
  workspaces: WorkspaceBridgeApi;
  canvas: CanvasBridgeApi;
}
