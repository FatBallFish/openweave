import type {
  CanvasLoadInput,
  CanvasSaveInput,
  CanvasStateInput,
  RunGetInput,
  RunListInput,
  RunRuntimeInput,
  RunStartInput,
  RunStatusInput,
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
  canvasSave: 'canvas:save',
  runStart: 'run:start',
  runGet: 'run:get',
  runList: 'run:list'
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

export interface RunRecord {
  id: string;
  workspaceId: string;
  nodeId: string;
  runtime: RunRuntimeInput;
  command: string;
  status: RunStatusInput;
  summary: string | null;
  tailLog: string;
  createdAtMs: number;
  startedAtMs: number | null;
  completedAtMs: number | null;
}

export interface RunMutationResponse {
  run: RunRecord;
}

export interface RunGetResponse {
  run: RunRecord;
}

export interface RunListResponse {
  runs: RunRecord[];
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

export interface RunsBridgeApi {
  startRun: (input: RunStartInput) => Promise<RunMutationResponse>;
  getRun: (input: RunGetInput) => Promise<RunGetResponse>;
  listRuns: (input: RunListInput) => Promise<RunListResponse>;
}

export interface OpenWeaveShellBridge {
  platform: string;
  ipcChannels: typeof IPC_CHANNELS;
  workspaces: WorkspaceBridgeApi;
  canvas: CanvasBridgeApi;
  runs: RunsBridgeApi;
}
