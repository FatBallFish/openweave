import crypto from 'node:crypto';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc/contracts';
import type {
  RoleListResponse,
  RoleMutationResponse,
  RoleDeleteResponse
} from '../../shared/ipc/contracts';
import {
  roleCreateSchema,
  roleDeleteSchema,
  roleUpdateSchema,
  type RoleCreateInput,
  type RoleDeleteInput,
  type RoleUpdateInput
} from '../../shared/ipc/schemas';
import type { RegistryRepository } from '../db/registry';

export interface RolesIpcDependencies {
  registry: RegistryRepository;
  now?: () => number;
  randomId?: () => string;
}

interface RolesIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

const resolveIpcMain = (): RolesIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

export const createRolesIpcHandlers = (deps: RolesIpcDependencies) => {
  const { registry, now = () => Date.now(), randomId = () => crypto.randomUUID() } = deps;

  return {
    listRoles: async (): Promise<RoleListResponse> => {
      return { roles: registry.listRoles() };
    },
    createRole: async (_event: IpcMainInvokeEvent, input: RoleCreateInput): Promise<RoleMutationResponse> => {
      const parsed = roleCreateSchema.parse(input);
      const timestamp = now();
      const role = registry.saveRole({
        id: randomId(),
        name: parsed.name,
        description: parsed.description,
        icon: parsed.icon,
        color: parsed.color,
        createdAtMs: timestamp,
        updatedAtMs: timestamp
      });
      return { role };
    },
    updateRole: async (_event: IpcMainInvokeEvent, input: RoleUpdateInput): Promise<RoleMutationResponse> => {
      const parsed = roleUpdateSchema.parse(input);
      const timestamp = now();
      const existing = registry.getRole(parsed.id);
      if (!existing) {
        throw new Error(`Role not found: ${parsed.id}`);
      }
      const role = registry.saveRole({
        ...existing,
        name: parsed.name,
        description: parsed.description,
        icon: parsed.icon,
        color: parsed.color,
        updatedAtMs: timestamp
      });
      return { role };
    },
    deleteRole: async (_event: IpcMainInvokeEvent, input: RoleDeleteInput): Promise<RoleDeleteResponse> => {
      const parsed = roleDeleteSchema.parse(input);
      const deleted = registry.deleteRole(parsed.id);
      return { deleted };
    }
  };
};

export const registerRolesIpcHandlers = (deps: RolesIpcDependencies): void => {
  const ipcMain = resolveIpcMain();
  const handlers = createRolesIpcHandlers(deps);

  ipcMain.removeHandler(IPC_CHANNELS.roleList);
  ipcMain.removeHandler(IPC_CHANNELS.roleCreate);
  ipcMain.removeHandler(IPC_CHANNELS.roleUpdate);
  ipcMain.removeHandler(IPC_CHANNELS.roleDelete);

  ipcMain.handle(IPC_CHANNELS.roleList, handlers.listRoles);
  ipcMain.handle(IPC_CHANNELS.roleCreate, handlers.createRole);
  ipcMain.handle(IPC_CHANNELS.roleUpdate, handlers.updateRole);
  ipcMain.handle(IPC_CHANNELS.roleDelete, handlers.deleteRole);
};

export const disposeRolesIpcHandlers = (): void => {
  const ipcMain = resolveIpcMain();
  ipcMain.removeHandler(IPC_CHANNELS.roleList);
  ipcMain.removeHandler(IPC_CHANNELS.roleCreate);
  ipcMain.removeHandler(IPC_CHANNELS.roleUpdate);
  ipcMain.removeHandler(IPC_CHANNELS.roleDelete);
};
