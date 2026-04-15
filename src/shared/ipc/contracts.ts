import type {
  WorkspaceCreateInput,
  WorkspaceDeleteInput,
  WorkspaceOpenInput
} from './schemas';

export const IPC_CHANNELS = {
  workspaceCreate: 'workspace:create',
  workspaceList: 'workspace:list',
  workspaceOpen: 'workspace:open',
  workspaceDelete: 'workspace:delete'
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

export interface WorkspaceBridgeApi {
  createWorkspace: (input: WorkspaceCreateInput) => Promise<WorkspaceMutationResponse>;
  listWorkspaces: () => Promise<WorkspaceListResponse>;
  openWorkspace: (input: WorkspaceOpenInput) => Promise<WorkspaceMutationResponse>;
  deleteWorkspace: (input: WorkspaceDeleteInput) => Promise<WorkspaceDeleteResponse>;
}

export interface OpenWeaveShellBridge {
  platform: string;
  ipcChannels: typeof IPC_CHANNELS;
  workspaces: WorkspaceBridgeApi;
}
