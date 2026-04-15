import os from 'node:os';
import path from 'node:path';
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
}

const createHandlers = (deps: WorkspaceIpcDependencies): WorkspaceIpcHandlers => {
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
      return {
        workspace: deps.registry.openWorkspace(parsed.workspaceId)
      };
    },
    delete: async (_event: IpcMainInvokeEvent, input: { workspaceId: string }) => {
      const parsed = workspaceDeleteSchema.parse(input);
      return {
        deleted: deps.registry.deleteWorkspace(parsed.workspaceId)
      };
    }
  };
};

let registryForIpc: RegistryRepository | null = null;

const getOrCreateRegistry = (dbFilePath: string): RegistryRepository => {
  if (!registryForIpc) {
    registryForIpc = createRegistryRepository({ dbFilePath });
  }
  return registryForIpc;
};

export const registerWorkspaceIpcHandlers = (dbFilePath: string): void => {
  const { ipcMain } = require('electron') as typeof import('electron');
  const handlers = createHandlers({ registry: getOrCreateRegistry(dbFilePath) });

  ipcMain.removeHandler(IPC_CHANNELS.workspaceCreate);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceList);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceOpen);
  ipcMain.removeHandler(IPC_CHANNELS.workspaceDelete);

  ipcMain.handle(IPC_CHANNELS.workspaceCreate, handlers.create);
  ipcMain.handle(IPC_CHANNELS.workspaceList, handlers.list);
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, handlers.open);
  ipcMain.handle(IPC_CHANNELS.workspaceDelete, handlers.delete);
};

const integrationRegistryPath = path.join(
  os.tmpdir(),
  'openweave-tests',
  `registry-task5-${process.pid}.sqlite`
);

const integrationHandlers = createHandlers({
  registry: createRegistryRepository({ dbFilePath: integrationRegistryPath })
});

export const createWorkspace = (input: WorkspaceCreateInput): Promise<WorkspaceMutationResponse> => {
  return integrationHandlers.create({} as IpcMainInvokeEvent, input);
};

export const listWorkspaces = (): ReturnType<WorkspaceIpcHandlers['list']>['workspaces'] => {
  return integrationHandlers.list({} as IpcMainInvokeEvent).workspaces;
};

export const openWorkspace = (workspaceId: string): Promise<WorkspaceMutationResponse> => {
  return integrationHandlers.open({} as IpcMainInvokeEvent, { workspaceId });
};

export const deleteWorkspace = (workspaceId: string): Promise<WorkspaceDeleteResponse> => {
  return integrationHandlers.delete({} as IpcMainInvokeEvent, { workspaceId });
};
