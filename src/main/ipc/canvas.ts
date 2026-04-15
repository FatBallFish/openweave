import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type CanvasLoadResponse,
  type CanvasSaveResponse
} from '../../shared/ipc/contracts';
import {
  canvasLoadSchema,
  canvasSaveSchema,
  type CanvasLoadInput,
  type CanvasSaveInput
} from '../../shared/ipc/schemas';
import { createWorkspaceRepository, type WorkspaceRepository } from '../db/workspace';

export interface CanvasIpcHandlers {
  load: (_event: IpcMainInvokeEvent, input: CanvasLoadInput) => Promise<CanvasLoadResponse>;
  save: (_event: IpcMainInvokeEvent, input: CanvasSaveInput) => Promise<CanvasSaveResponse>;
}

export interface CanvasIpcDependencies {
  getWorkspaceRepository: (workspaceId: string) => WorkspaceRepository;
}

interface CanvasIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export const createCanvasIpcHandlers = (deps: CanvasIpcDependencies): CanvasIpcHandlers => {
  return {
    load: async (_event: IpcMainInvokeEvent, input: CanvasLoadInput) => {
      const parsed = canvasLoadSchema.parse(input);
      return {
        state: deps.getWorkspaceRepository(parsed.workspaceId).loadCanvasState()
      };
    },
    save: async (_event: IpcMainInvokeEvent, input: CanvasSaveInput) => {
      const parsed = canvasSaveSchema.parse(input);
      return {
        state: deps.getWorkspaceRepository(parsed.workspaceId).saveCanvasState(parsed.state)
      };
    }
  };
};

interface RegisteredCanvasIpcContext {
  workspaceDbDir: string;
  repositories: Map<string, WorkspaceRepository>;
}

let registeredCanvasIpcContext: RegisteredCanvasIpcContext | null = null;

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const resetCanvasContextForDir = (workspaceDbDir: string): RegisteredCanvasIpcContext => {
  if (registeredCanvasIpcContext && registeredCanvasIpcContext.workspaceDbDir !== workspaceDbDir) {
    for (const repository of registeredCanvasIpcContext.repositories.values()) {
      repository.close();
    }
    registeredCanvasIpcContext = null;
  }

  if (!registeredCanvasIpcContext) {
    registeredCanvasIpcContext = {
      workspaceDbDir,
      repositories: new Map<string, WorkspaceRepository>()
    };
  }

  return registeredCanvasIpcContext;
};

const resolveWorkspaceRepository = (workspaceId: string, workspaceDbDir: string): WorkspaceRepository => {
  const context = resetCanvasContextForDir(workspaceDbDir);
  const existing = context.repositories.get(workspaceId);
  if (existing) {
    return existing;
  }

  const repository = createWorkspaceRepository({
    dbFilePath: path.join(context.workspaceDbDir, `${toWorkspaceDbFileName(workspaceId)}.db`)
  });
  context.repositories.set(workspaceId, repository);
  return repository;
};

const resolveIpcMain = (): CanvasIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

export interface RegisterCanvasIpcHandlersOptions {
  workspaceDbDir: string;
  ipcMain?: CanvasIpcMain;
}

export const registerCanvasIpcHandlers = (options: RegisterCanvasIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const handlers = createCanvasIpcHandlers({
    getWorkspaceRepository: (workspaceId: string) =>
      resolveWorkspaceRepository(workspaceId, options.workspaceDbDir)
  });

  ipcMain.removeHandler(IPC_CHANNELS.canvasLoad);
  ipcMain.removeHandler(IPC_CHANNELS.canvasSave);

  ipcMain.handle(IPC_CHANNELS.canvasLoad, handlers.load);
  ipcMain.handle(IPC_CHANNELS.canvasSave, handlers.save);
};

export const disposeCanvasIpcHandlers = (): void => {
  if (!registeredCanvasIpcContext) {
    return;
  }

  for (const repository of registeredCanvasIpcContext.repositories.values()) {
    repository.close();
  }
  registeredCanvasIpcContext = null;
};
