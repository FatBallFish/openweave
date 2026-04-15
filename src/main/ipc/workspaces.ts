import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type WorkspaceDeleteResponse,
  type WorkspaceListResponse,
  type WorkspaceMutationResponse
} from '../../shared/ipc/contracts';
import {
  workspaceCreateSchema,
  workspaceDeleteSchema,
  workspaceOpenSchema,
  type WorkspaceCreateInput
} from '../../shared/ipc/schemas';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';

export interface WorkspaceIpcHandlers {
  create: (_event: IpcMainInvokeEvent, input: WorkspaceCreateInput) => Promise<WorkspaceMutationResponse>;
  list: (_event: IpcMainInvokeEvent) => WorkspaceListResponse;
  open: (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => Promise<WorkspaceMutationResponse>;
  delete: (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => Promise<WorkspaceDeleteResponse>;
}

export interface WorkspaceIpcDependencies {
  registry: RegistryRepository;
  onWorkspaceOpened?: (workspaceId: string) => void | Promise<void>;
  onWorkspaceDeleted?: (workspaceId: string) => void;
}

interface WorkspaceIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export const createWorkspaceIpcHandlers = (deps: WorkspaceIpcDependencies): WorkspaceIpcHandlers => {
  return {
    create: async (_event: IpcMainInvokeEvent, input: WorkspaceCreateInput) => {
      const parsed = workspaceCreateSchema.parse(input);
      return {
        workspace: deps.registry.createWorkspace(parsed)
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
    delete: async (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => {
      const parsed = workspaceDeleteSchema.parse(input);
      const deleted = deps.registry.deleteWorkspace(parsed.workspaceId);
      if (deleted) {
        deps.onWorkspaceDeleted?.(parsed.workspaceId);
      }
      return {
        deleted
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
  onWorkspaceOpened?: (workspaceId: string) => void | Promise<void>;
  onWorkspaceDeleted?: (workspaceId: string) => void;
}

export const registerWorkspaceIpcHandlers = (
  options: RegisterWorkspaceIpcHandlersOptions
): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const handlers = createWorkspaceIpcHandlers({
    registry: getOrCreateRegistryForPath(options.dbFilePath),
    onWorkspaceOpened: options.onWorkspaceOpened,
    onWorkspaceDeleted: options.onWorkspaceDeleted
  });

  ipcMain.removeHandler(IPC_CHANNELS.workspaceCreate);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceList);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceOpen);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceDelete);

  ipcMain.handle(IPC_CHANNELS.workspaceCreate, handlers.create);
  ipcMain.handle(IPC_CHANNELS.workspaceList, handlers.list);
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, handlers.open);
  ipcMain.handle(IPC_CHANNELS.workspaceDelete, handlers.delete);
};

export const disposeWorkspaceIpcHandlers = (): void => {
  if (registeredWorkspaceIpcContext) {
    registeredWorkspaceIpcContext.registry.close();
    registeredWorkspaceIpcContext = null;
  }
};
