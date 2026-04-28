import type {
  CanvasLoadInput,
  CanvasSaveInput,
  CanvasStateInput,
  ComponentInstallInput,
  ComponentInstallSourceTypeInput,
  ComponentListInput,
  ComponentUninstallInput,
  FileTreeLoadInput,
  GraphLoadV2Input,
  GraphSaveV2Input,
  GraphSnapshotV2Input,
  NodeActionInput,
  NodeGetInput,
  NodeListInput,
  NodeNeighborsInput,
  NodeReadInput,
  PortalCaptureInput,
  PortalClickInput,
  PortalInputInput,
  PortalLoadInput,
  PortalStructureInput,
  RoleCreateInput,
  RoleDeleteInput,
  RoleUpdateInput,
  RunGetInput,
  RunInputInput,
  RunListInput,
  RunResizeInput,
  RunRuntimeInput,
  RunStartInput,
  RunStopInput,
  RunStatusInput,
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
  WorkspaceInfoInput,
  WorkspaceOpenInput,
  WorkspacePickDirectoryInput,
  WorkspaceRevealDirectoryInput,
  WorkspaceUpdateInput
} from './schemas';
import type {
  ComponentActionManifest,
  ComponentCapability,
  ComponentManifestV1
} from '../components/manifest';
import type {
  PortalScreenshotResult,
  PortalSessionRecord,
  PortalStructureResult
} from '../portal/types';

export const IPC_CHANNELS = {
  workspaceCreate: 'workspace:create',
  workspaceList: 'workspace:list',
  workspaceOpen: 'workspace:open',
  workspaceDelete: 'workspace:delete',
  workspaceUpdate: 'workspace:update',
  workspacePickDirectory: 'workspace:pick-directory',
  workspaceRevealDirectory: 'workspace:reveal-directory',
  workspaceCreateBranch: 'workspace:create-branch',
  workspaceGroupList: 'workspace-group:list',
  workspaceGroupCreate: 'workspace-group:create',
  workspaceGroupUpdate: 'workspace-group:update',
  workspaceGroupDelete: 'workspace-group:delete',
  workspaceGroupCollapseSet: 'workspace-group:set-collapsed',
  workspaceMoveToGroup: 'workspace:move-to-group',
  workspaceMoveToUngrouped: 'workspace:move-to-ungrouped',
  workspaceReorderUngrouped: 'workspace:reorder-ungrouped',
  workspaceReorderGroups: 'workspace-group:reorder',
  workspaceReorderGroupMembers: 'workspace-group:reorder-members',
  componentList: 'component:list',
  componentInstall: 'component:install',
  componentUninstall: 'component:uninstall',
  canvasLoad: 'canvas:load',
  canvasSave: 'canvas:save',
  graphLoad: 'graph:load-v2',
  graphSave: 'graph:save-v2',
  graphEdgeActivationsConsume: 'graph:edge-activations:consume',
  runStart: 'run:start',
  runGet: 'run:get',
  runList: 'run:list',
  runInput: 'run:input',
  runStop: 'run:stop',
  fileTreeLoad: 'file-tree:load',
  portalLoad: 'portal:load',
  portalCapture: 'portal:capture',
  portalReadStructure: 'portal:read-structure',
  portalClick: 'portal:click',
  portalInput: 'portal:input',
  appOpenSettings: 'app:open-settings',
  runStream: 'run:stream',
  runStreamSubscribe: 'run:stream:subscribe',
  runStreamUnsubscribe: 'run:stream:unsubscribe',
  runResize: 'run:resize',
  roleList: 'role:list',
  roleCreate: 'role:create',
  roleUpdate: 'role:update',
  roleDelete: 'role:delete',
  noteFileCreate: 'note:file-create',
  noteFileRead: 'note:file-read',
  noteFileWrite: 'note:file-write',
  noteFileDelete: 'note:file-delete',
  noteFileRename: 'note:file-rename',
  graphEdgeHighlight: 'graph:edge-highlight'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface WorkspaceGroupRecord {
  id: string;
  name: string;
  sortOrder: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface WorkspaceGroupUiStateRecord {
  groupId: string;
  collapsed: boolean;
  updatedAtMs: number;
}

export interface WorkspaceGroupListResponse {
  groups: WorkspaceGroupRecord[];
  uiState: WorkspaceGroupUiStateRecord[];
}

export interface WorkspaceGroupMutationResponse {
  group: WorkspaceGroupRecord;
}

export interface WorkspaceGroupDeleteResponse {
  deleted: boolean;
}

export interface WorkspaceGroupCollapseSetResponse {
  groupId: string;
  collapsed: boolean;
}

export interface WorkspaceMoveResponse {
  ok: true;
}

export interface WorkspaceReorderResponse {
  ok: true;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  rootDir: string;
  createdAtMs: number;
  updatedAtMs: number;
  lastOpenedAtMs: number | null;
  iconKey?: string;
  iconColor?: string;
  sourceWorkspaceId?: string | null;
  branchName?: string | null;
  groupId?: string | null;
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

export interface WorkspaceDirectoryPickResponse {
  directory: string | null;
}

export interface WorkspaceRevealDirectoryResponse {
  ok: true;
}

export interface WorkspaceInfoResponse {
  workspaceId: string;
  name: string;
  rootDir: string;
  graphSchemaVersion: 2;
  nodeCount: number;
  edgeCount: number;
}

export interface CanvasLoadResponse {
  state: CanvasStateInput;
}

export interface CanvasSaveResponse {
  state: CanvasStateInput;
}

export interface GraphLoadResponseV2 {
  graphSnapshot: GraphSnapshotV2Input;
}

export interface GraphSaveResponseV2 {
  graphSnapshot: GraphSnapshotV2Input;
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
  tailStartOffset: number;
  tailEndOffset: number;
  createdAtMs: number;
  startedAtMs: number | null;
  completedAtMs: number | null;
}

export interface RunStreamEvent {
  runId: string;
  chunk: string;
  chunkStartOffset: number;
  chunkEndOffset: number;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface RoleListResponse {
  roles: RoleRecord[];
}

export interface RoleMutationResponse {
  role: RoleRecord;
}

export interface RoleDeleteResponse {
  deleted: boolean;
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

export interface RunInputResponse {
  ok: true;
}

export type GitFileStatusCode = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?' | '!';

export interface FileTreeEntryRecord {
  path: string;
  kind: 'file' | 'directory';
  gitStatus: GitFileStatusCode | null;
}

export interface GitStatusSummaryRecord {
  modified: number;
  added: number;
  deleted: number;
  renamed: number;
  copied: number;
  unmerged: number;
  untracked: number;
  ignored: number;
}

export interface FileTreeLoadResponse {
  rootDir: string;
  readOnly: true;
  isGitRepo: boolean;
  gitSummary: GitStatusSummaryRecord;
  entries: FileTreeEntryRecord[];
}

export interface PortalLoadResponse {
  portal: PortalSessionRecord;
}

export interface PortalCaptureResponse {
  screenshot: PortalScreenshotResult;
}

export interface PortalStructureResponse {
  structure: PortalStructureResult;
}

export interface PortalClickResponse {
  ok: true;
}

export interface PortalInputResponse {
  ok: true;
}

export interface ComponentSummaryRecord {
  name: string;
  version: string;
  kind: ComponentManifestV1['kind'];
  displayName: string;
  category: string;
  capabilities: ComponentCapability[];
  installed: boolean;
  builtin: boolean;
}

export interface ComponentInstallRecord {
  componentId: string;
  name: string;
  version: string;
  sourceType: ComponentInstallSourceTypeInput;
  installRoot: string;
}

export interface ComponentListResponse {
  components: ComponentSummaryRecord[];
}

export interface ComponentInstallResponse {
  component: ComponentInstallRecord;
}

export interface ComponentUninstallResponse {
  name: string;
  version: string | null;
  uninstalled: boolean;
  fallbackRequired: boolean;
}

export interface GraphNodeSummaryRecord {
  id: string;
  title: string;
  componentType: string;
  componentVersion: string;
  capabilities: ComponentCapability[];
}

export interface GraphNodeRecord {
  id: string;
  componentType: string;
  componentVersion: string;
  title: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  capabilities: ComponentCapability[];
}

export interface GraphNodeGetResponse {
  node: GraphNodeRecord;
}

export interface GraphNodeListResponse {
  nodes: GraphNodeSummaryRecord[];
}

export interface GraphNodeNeighborRecord {
  edgeId: string;
  nodeId: string;
  componentType: string;
  title: string;
}

export interface GraphNodeNeighborsResponse {
  nodeId: string;
  upstream: GraphNodeNeighborRecord[];
  downstream: GraphNodeNeighborRecord[];
}

export interface GraphNodeReadResponse {
  nodeId: string;
  action: 'read';
  result: Record<string, unknown>;
}

export interface GraphNodeActionResponse {
  nodeId: string;
  action: string;
  ok: true;
  result: Record<string, unknown>;
}

export interface ComponentMetadataRecord {
  manifest: ComponentManifestV1;
  actions: ComponentActionManifest[];
}

export interface WorkspaceBridgeApi {
  createWorkspace: (input: WorkspaceCreateInput) => Promise<WorkspaceMutationResponse>;
  createBranchWorkspace: (input: WorkspaceBranchCreateInput) => Promise<WorkspaceMutationResponse>;
  listWorkspaces: () => Promise<WorkspaceListResponse>;
  openWorkspace: (input: WorkspaceOpenInput) => Promise<WorkspaceMutationResponse>;
  deleteWorkspace: (input: WorkspaceDeleteInput) => Promise<WorkspaceDeleteResponse>;
  updateWorkspace: (input: WorkspaceUpdateInput) => Promise<WorkspaceMutationResponse>;
  listWorkspaceGroups: () => Promise<WorkspaceGroupListResponse>;
  createWorkspaceGroup: (input: WorkspaceGroupCreateInput) => Promise<WorkspaceGroupMutationResponse>;
  updateWorkspaceGroup: (input: WorkspaceGroupUpdateInput) => Promise<WorkspaceGroupMutationResponse>;
  deleteWorkspaceGroup: (input: WorkspaceGroupDeleteInput) => Promise<WorkspaceGroupDeleteResponse>;
  setWorkspaceGroupCollapsed: (
    input: WorkspaceGroupCollapseSetInput
  ) => Promise<WorkspaceGroupCollapseSetResponse>;
  moveWorkspaceToGroup: (input: WorkspaceGroupMoveInput) => Promise<WorkspaceMoveResponse>;
  moveWorkspaceToUngrouped: (
    input: WorkspaceGroupMoveToUngroupedInput
  ) => Promise<WorkspaceMoveResponse>;
  reorderUngroupedWorkspaces: (
    input: WorkspaceGroupReorderUngroupedInput
  ) => Promise<WorkspaceReorderResponse>;
  reorderWorkspaceGroups: (input: WorkspaceGroupReorderGroupsInput) => Promise<WorkspaceReorderResponse>;
  reorderGroupMembers: (
    input: WorkspaceGroupReorderWithinGroupInput
  ) => Promise<WorkspaceReorderResponse>;
  pickWorkspaceDirectory: (
    input: WorkspacePickDirectoryInput
  ) => Promise<WorkspaceDirectoryPickResponse>;
  revealWorkspaceDirectory: (
    input: WorkspaceRevealDirectoryInput
  ) => Promise<WorkspaceRevealDirectoryResponse>;
}

export interface CanvasBridgeApi {
  loadCanvasState: (input: CanvasLoadInput) => Promise<CanvasLoadResponse>;
  saveCanvasState: (input: CanvasSaveInput) => Promise<CanvasSaveResponse>;
}

export interface GraphBridgeApiV2 {
  loadGraphSnapshot: (input: GraphLoadV2Input) => Promise<GraphLoadResponseV2>;
  saveGraphSnapshot: (input: GraphSaveV2Input) => Promise<GraphSaveResponseV2>;
  consumeEdgeActivations: (input: { workspaceId: string }) => Promise<{ edgeIds: string[] }>;
}

export interface RunsBridgeApi {
  startRun: (input: RunStartInput) => Promise<RunMutationResponse>;
  getRun: (input: RunGetInput) => Promise<RunGetResponse>;
  listRuns: (input: RunListInput) => Promise<RunListResponse>;
  inputRun: (input: RunInputInput) => Promise<RunInputResponse>;
  stopRun: (input: RunStopInput) => Promise<RunMutationResponse>;
  subscribeStream: (runId: string) => void;
  unsubscribeStream: (runId: string) => void;
  onStream: (callback: (event: RunStreamEvent) => void) => () => void;
  resizeRun: (input: RunResizeInput) => Promise<void>;
}

export interface FilesBridgeApi {
  loadFileTree: (input: FileTreeLoadInput) => Promise<FileTreeLoadResponse>;
}

export interface PortalBridgeApi {
  loadPortal: (input: PortalLoadInput) => Promise<PortalLoadResponse>;
  capturePortalScreenshot: (input: PortalCaptureInput) => Promise<PortalCaptureResponse>;
  readPortalStructure: (input: PortalStructureInput) => Promise<PortalStructureResponse>;
  clickPortalElement: (input: PortalClickInput) => Promise<PortalClickResponse>;
  inputPortalText: (input: PortalInputInput) => Promise<PortalInputResponse>;
}

export interface AgentWorkspaceBridgeApi {
  getWorkspaceInfo: (input: WorkspaceInfoInput) => Promise<WorkspaceInfoResponse>;
}

export interface AgentNodeBridgeApi {
  listNodes: (input: NodeListInput) => Promise<GraphNodeListResponse>;
  getNode: (input: NodeGetInput) => Promise<GraphNodeGetResponse>;
  getNodeNeighbors: (input: NodeNeighborsInput) => Promise<GraphNodeNeighborsResponse>;
  readNode: (input: NodeReadInput) => Promise<GraphNodeReadResponse>;
  runNodeAction: (input: NodeActionInput) => Promise<GraphNodeActionResponse>;
}

export interface AgentComponentBridgeApi {
  listComponents: (input: ComponentListInput) => Promise<ComponentListResponse>;
  installComponent: (input: ComponentInstallInput) => Promise<ComponentInstallResponse>;
  uninstallComponent: (input: ComponentUninstallInput) => Promise<ComponentUninstallResponse>;
}

export interface NoteFileCreateResponse { filePath: string; ok: true; }
export interface NoteFileReadResponse { filePath: string; content: string; }
export interface NoteFileWriteResponse { filePath: string; ok: true; }
export interface NoteFileDeleteResponse { filePath: string; ok: true; }
export interface NoteFileRenameResponse { oldPath: string; newPath: string; ok: true; }

export interface NotesBridgeApi {
  createFile: (input: import('./schemas').NoteFileCreateInput) => Promise<NoteFileCreateResponse>;
  readFile: (input: import('./schemas').NoteFileReadInput) => Promise<NoteFileReadResponse>;
  writeFile: (input: import('./schemas').NoteFileWriteInput) => Promise<NoteFileWriteResponse>;
  deleteFile: (input: import('./schemas').NoteFileDeleteInput) => Promise<NoteFileDeleteResponse>;
  renameFile: (input: import('./schemas').NoteFileRenameInput) => Promise<NoteFileRenameResponse>;
}

export interface AppBridgeApi {
  openSettings: () => Promise<void>;
}

export interface RolesBridgeApi {
  listRoles: () => Promise<RoleListResponse>;
  createRole: (input: RoleCreateInput) => Promise<RoleMutationResponse>;
  updateRole: (input: RoleUpdateInput) => Promise<RoleMutationResponse>;
  deleteRole: (input: RoleDeleteInput) => Promise<RoleDeleteResponse>;
}

export interface OpenWeaveShellBridge {
  platform: string;
  ipcChannels: typeof IPC_CHANNELS;
  workspaces: WorkspaceBridgeApi;
  components: AgentComponentBridgeApi;
  canvas: CanvasBridgeApi;
  graph: GraphBridgeApiV2;
  runs: RunsBridgeApi;
  roles: RolesBridgeApi;
  notes: NotesBridgeApi;
  files: FilesBridgeApi;
  portal: PortalBridgeApi;
  app: AppBridgeApi;
}
