import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type WorkspaceRecord,
  type WorkspaceDeleteResponse,
  type WorkspaceDirectoryPickResponse,
  type WorkspaceListResponse,
  type WorkspaceMutationResponse,
  type WorkspaceRevealDirectoryResponse
} from '../../shared/ipc/contracts';
import {
  workspaceCreateSchema,
  workspaceDeleteSchema,
  workspaceGroupCreateSchema,
  workspaceGroupDeleteSchema,
  workspaceGroupMoveSchema,
  workspacePickDirectorySchema,
  workspaceRevealDirectorySchema,
  workspaceOpenSchema,
  workspaceUpdateSchema,
  type WorkspaceCreateInput,
  type WorkspaceUpdateInput
} from '../../shared/ipc/schemas';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';

export interface WorkspaceIpcHandlers {
  create: (_event: IpcMainInvokeEvent, input: WorkspaceCreateInput) => Promise<WorkspaceMutationResponse>;
  list: (_event: IpcMainInvokeEvent) => WorkspaceListResponse;
  open: (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => Promise<WorkspaceMutationResponse>;
  delete: (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => Promise<WorkspaceDeleteResponse>;
  update: (_event: IpcMainInvokeEvent, input: WorkspaceUpdateInput) => Promise<WorkspaceMutationResponse>;
  groupList: (_event: IpcMainInvokeEvent) => Promise<{ groups: unknown[]; uiState: unknown[] }>;
  groupCreate: (_event: IpcMainInvokeEvent, input: { name: string }) => Promise<{ group: { id: string; name: string } }>;
  groupUpdate: (_event: IpcMainInvokeEvent, input: { groupId: string; name: string }) => Promise<{ group: { id: string; name: string } }>;
  groupDelete: (_event: IpcMainInvokeEvent, input: { groupId: string }) => Promise<{ deleted: boolean }>;
  groupCollapseSet: (_event: IpcMainInvokeEvent, input: { groupId: string; collapsed: boolean }) => Promise<{ groupId: string; collapsed: boolean; updatedAtMs: number }>;
  moveToGroup: (
    _event: IpcMainInvokeEvent,
    input: { workspaceId: string; groupId: string; targetIndex: number }
  ) => Promise<{ ok: true }>;
  moveToUngrouped: (_event: IpcMainInvokeEvent, input: { workspaceId: string; targetIndex: number }) => Promise<{ ok: true }>;
  reorderUngrouped: (_event: IpcMainInvokeEvent, input: { workspaceIds: string[] }) => Promise<{ ok: true }>;
  reorderGroups: (_event: IpcMainInvokeEvent, input: { groupIds: string[] }) => Promise<{ ok: true }>;
  reorderGroupMembers: (_event: IpcMainInvokeEvent, input: { groupId: string; workspaceIds: string[] }) => Promise<{ ok: true }>;
  pickDirectory: (
    _event: IpcMainInvokeEvent,
    input: { initialPath?: string } | undefined
  ) => Promise<WorkspaceDirectoryPickResponse>;
  revealDirectory: (
    _event: IpcMainInvokeEvent,
    input: { directory: string }
  ) => Promise<WorkspaceRevealDirectoryResponse>;
}

export interface WorkspaceIpcDependencies {
  registry: RegistryRepository;
  onWorkspaceCreated?: (workspaceId: string) => void | Promise<void>;
  onWorkspaceOpened?: (workspaceId: string) => void | Promise<void>;
  onWorkspaceDeleting?: (workspace: WorkspaceRecord) => void | Promise<void>;
  onWorkspaceDeleted?: (workspaceId: string) => void;
}

interface WorkspaceIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

interface WorkspaceDesktopBridge {
  dialog: {
    showOpenDialog: (...args: any[]) => Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  shell: {
    openPath: (path: string) => Promise<string>;
  };
  BrowserWindow: {
    getFocusedWindow: () => unknown;
  };
}

const resolveWorkspaceDesktopBridge = (): WorkspaceDesktopBridge => {
  const { dialog, shell, BrowserWindow } = require('electron') as typeof import('electron');
  return {
    dialog,
    shell,
    BrowserWindow
  };
};

export const createWorkspaceIpcHandlers = (deps: WorkspaceIpcDependencies): WorkspaceIpcHandlers => {
  return {
    create: async (_event: IpcMainInvokeEvent, input: WorkspaceCreateInput) => {
      const parsed = workspaceCreateSchema.parse(input);
      const createdWorkspace = deps.registry.createWorkspace(parsed);
      await deps.onWorkspaceCreated?.(createdWorkspace.id);
      return {
        workspace: createdWorkspace
      };
    },
    list: (_event: IpcMainInvokeEvent) => {
      return {
        workspaces: deps.registry.listWorkspaces()
      };
    },
    open: async (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => {
      const parsed = workspaceOpenSchema.parse(input);
      await deps.onWorkspaceOpened?.(parsed.workspaceId);
      return {
        workspace: deps.registry.openWorkspace(parsed.workspaceId)
      };
    },
    update: async (_event: IpcMainInvokeEvent, input: WorkspaceUpdateInput) => {
      const parsed = workspaceUpdateSchema.parse(input);
      return {
        workspace: deps.registry.updateWorkspace(parsed)
      };
    },
    groupList: async (_event: IpcMainInvokeEvent) => {
      const groups = deps.registry.listWorkspaceGroups();
      const uiState = deps.registry.listWorkspaceGroupUiState();
      return { groups, uiState };
    },
    groupCreate: async (_event: IpcMainInvokeEvent, input: { name: string }) => {
      const parsed = workspaceGroupCreateSchema.parse(input);
      return {
        group: deps.registry.createWorkspaceGroup(parsed)
      };
    },
    moveToGroup: async (
      _event: IpcMainInvokeEvent,
      input: { workspaceId: string; groupId: string; targetIndex: number }
    ) => {
      const parsed = workspaceGroupMoveSchema.parse(input);
      deps.registry.moveWorkspaceToGroup(parsed);
      return {
        ok: true
      };
    },
    groupUpdate: async (_event: IpcMainInvokeEvent, input: { groupId: string; name: string }) => {
      const group = deps.registry.updateWorkspaceGroup(input.groupId, input.name);
      return { group };
    },
    groupDelete: async (_event: IpcMainInvokeEvent, input: { groupId: string }) => {
      const parsed = workspaceGroupDeleteSchema.parse(input);
      const deleted = deps.registry.deleteWorkspaceGroup(parsed.groupId);
      return {
        deleted
      };
    },
    groupCollapseSet: async (_event: IpcMainInvokeEvent, input: { groupId: string; collapsed: boolean }) => {
      const result = deps.registry.setWorkspaceGroupCollapsed(input.groupId, input.collapsed);
      return result;
    },
    moveToUngrouped: async (_event: IpcMainInvokeEvent, input: { workspaceId: string; targetIndex: number }) => {
      deps.registry.moveWorkspaceToUngrouped(input.workspaceId, input.targetIndex);
      return { ok: true };
    },
    reorderUngrouped: async (_event: IpcMainInvokeEvent, input: { workspaceIds: string[] }) => {
      deps.registry.reorderUngroupedWorkspaces(input.workspaceIds);
      return { ok: true };
    },
    reorderGroups: async (_event: IpcMainInvokeEvent, input: { groupIds: string[] }) => {
      deps.registry.reorderWorkspaceGroups(input.groupIds);
      return { ok: true };
    },
    reorderGroupMembers: async (_event: IpcMainInvokeEvent, input: { groupId: string; workspaceIds: string[] }) => {
      deps.registry.reorderGroupMembers(input.groupId, input.workspaceIds);
      return { ok: true };
    },
    delete: async (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => {
      const parsed = workspaceDeleteSchema.parse(input);
      if (!deps.registry.hasWorkspace(parsed.workspaceId)) {
        return {
          deleted: false
        };
      }
      const workspace = deps.registry.getWorkspace(parsed.workspaceId);
      await deps.onWorkspaceDeleting?.(workspace);
      const deleted = deps.registry.deleteWorkspace(parsed.workspaceId);
      if (deleted) {
        deps.onWorkspaceDeleted?.(parsed.workspaceId);
      }
      return {
        deleted
      };
    },
    pickDirectory: async (_event: IpcMainInvokeEvent, input) => {
      const parsed = workspacePickDirectorySchema.parse(input ?? {});
      const desktop = resolveWorkspaceDesktopBridge();
      const focusedWindow = desktop.BrowserWindow.getFocusedWindow();
      const options = {
        defaultPath: parsed.initialPath,
        properties: ['openDirectory', 'createDirectory']
      } as const;
      const result = focusedWindow
        ? await desktop.dialog.showOpenDialog(focusedWindow, options)
        : await desktop.dialog.showOpenDialog(options);
      return {
        directory: result.canceled ? null : result.filePaths[0] ?? null
      };
    },
    revealDirectory: async (_event: IpcMainInvokeEvent, input) => {
      const parsed = workspaceRevealDirectorySchema.parse(input);
      const desktop = resolveWorkspaceDesktopBridge();
      const errorMessage = await desktop.shell.openPath(parsed.directory);
      if (errorMessage.length > 0) {
        throw new Error(errorMessage);
      }
      return {
        ok: true
      };
    }
  };
};

interface RegisteredWorkspaceIpcContext {
  dbFilePath: string;
  registry: RegistryRepository;
}

let registeredWorkspaceIpcContext: RegisteredWorkspaceIpcContext | null = null;

const getOrCreateRegistryForPath = (dbFilePath: string): RegistryRepository => {
  if (!registeredWorkspaceIpcContext) {
    registeredWorkspaceIpcContext = {
      dbFilePath,
      registry: createRegistryRepository({ dbFilePath })
    };
    return registeredWorkspaceIpcContext.registry;
  }

  if (registeredWorkspaceIpcContext.dbFilePath !== dbFilePath) {
    registeredWorkspaceIpcContext.registry.close();
    registeredWorkspaceIpcContext = {
      dbFilePath,
      registry: createRegistryRepository({ dbFilePath })
    };
  }

  return registeredWorkspaceIpcContext.registry;
};

const resolveIpcMain = (): WorkspaceIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

export interface RegisterWorkspaceIpcHandlersOptions {
  dbFilePath: string;
  ipcMain?: WorkspaceIpcMain;
  onWorkspaceCreated?: (workspaceId: string) => void | Promise<void>;
  onWorkspaceOpened?: (workspaceId: string) => void | Promise<void>;
  onWorkspaceDeleting?: (workspace: WorkspaceRecord) => void | Promise<void>;
  onWorkspaceDeleted?: (workspaceId: string) => void;
}

export const registerWorkspaceIpcHandlers = (
  options: RegisterWorkspaceIpcHandlersOptions
): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const handlers = createWorkspaceIpcHandlers({
    registry: getOrCreateRegistryForPath(options.dbFilePath),
    onWorkspaceCreated: options.onWorkspaceCreated,
    onWorkspaceOpened: options.onWorkspaceOpened,
    onWorkspaceDeleting: options.onWorkspaceDeleting,
    onWorkspaceDeleted: options.onWorkspaceDeleted
  });

  ipcMain.removeHandler(IPC_CHANNELS.workspaceCreate);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceList);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceOpen);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceDelete);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceUpdate);
  ipcMain.removeHandler(IPC_CHANNELS.workspacePickDirectory);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceRevealDirectory);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceGroupList);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceGroupCreate);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceGroupUpdate);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceGroupDelete);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceGroupCollapseSet);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceMoveToGroup);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceMoveToUngrouped);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceReorderUngrouped);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceReorderGroups);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceReorderGroupMembers);

  ipcMain.handle(IPC_CHANNELS.workspaceCreate, handlers.create);
  ipcMain.handle(IPC_CHANNELS.workspaceList, handlers.list);
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, handlers.open);
  ipcMain.handle(IPC_CHANNELS.workspaceDelete, handlers.delete);
  ipcMain.handle(IPC_CHANNELS.workspaceUpdate, handlers.update);
  ipcMain.handle(IPC_CHANNELS.workspacePickDirectory, handlers.pickDirectory);
  ipcMain.handle(IPC_CHANNELS.workspaceRevealDirectory, handlers.revealDirectory);
  ipcMain.handle(IPC_CHANNELS.workspaceGroupList, handlers.groupList);
  ipcMain.handle(IPC_CHANNELS.workspaceGroupCreate, handlers.groupCreate);
  ipcMain.handle(IPC_CHANNELS.workspaceGroupUpdate, handlers.groupUpdate);
  ipcMain.handle(IPC_CHANNELS.workspaceGroupDelete, handlers.groupDelete);
  ipcMain.handle(IPC_CHANNELS.workspaceGroupCollapseSet, handlers.groupCollapseSet);
  ipcMain.handle(IPC_CHANNELS.workspaceMoveToGroup, handlers.moveToGroup);
  ipcMain.handle(IPC_CHANNELS.workspaceMoveToUngrouped, handlers.moveToUngrouped);
  ipcMain.handle(IPC_CHANNELS.workspaceReorderUngrouped, handlers.reorderUngrouped);
  ipcMain.handle(IPC_CHANNELS.workspaceReorderGroups, handlers.reorderGroups);
  ipcMain.handle(IPC_CHANNELS.workspaceReorderGroupMembers, handlers.reorderGroupMembers);
};

export const disposeWorkspaceIpcHandlers = (): void => {
  if (registeredWorkspaceIpcContext) {
    registeredWorkspaceIpcContext.registry.close();
    registeredWorkspaceIpcContext = null;
  }
};
