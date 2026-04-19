import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type CanvasLoadResponse,
  type CanvasSaveResponse,
  type GraphLoadResponseV2,
  type GraphSaveResponseV2
} from '../../shared/ipc/contracts';
import {
  canvasLoadSchema,
  canvasSaveSchema,
  graphLoadSchemaV2,
  graphSaveSchemaV2,
  type CanvasStateInput,
  type CanvasLoadInput,
  type CanvasSaveInput,
  type GraphLoadV2Input,
  type GraphSaveV2Input,
  type GraphSnapshotV2Input
} from '../../shared/ipc/schemas';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { createWorkspaceRepository, type WorkspaceRepository } from '../db/workspace';
import { sanitizePathWithinRoot } from '../workspace/path-boundary';

export interface CanvasIpcHandlers {
  load: (_event: IpcMainInvokeEvent, input: CanvasLoadInput) => Promise<CanvasLoadResponse>;
  save: (_event: IpcMainInvokeEvent, input: CanvasSaveInput) => Promise<CanvasSaveResponse>;
  graphLoad: (_event: IpcMainInvokeEvent, input: GraphLoadV2Input) => Promise<GraphLoadResponseV2>;
  graphSave: (_event: IpcMainInvokeEvent, input: GraphSaveV2Input) => Promise<GraphSaveResponseV2>;
}

export interface CanvasIpcDependencies {
  assertWorkspaceExists: (workspaceId: string) => void;
  resolveWorkspaceRootDir: (workspaceId: string) => string;
  getWorkspaceRepository: (workspaceId: string) => WorkspaceRepository;
}

interface CanvasIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

const sanitizeCanvasStateForWorkspace = (
  state: CanvasStateInput,
  workspaceRootDir: string
): CanvasStateInput => {
  return {
    ...state,
    nodes: state.nodes.map((node) => {
      if (node.type !== 'file-tree') {
        return node;
      }
      return {
        ...node,
        rootDir: sanitizePathWithinRoot(workspaceRootDir, node.rootDir)
      };
    })
  };
};

const sanitizeGraphSnapshotForWorkspace = (
  graphSnapshot: GraphSnapshotV2Input,
  workspaceRootDir: string
): GraphSnapshotV2Input => {
  return {
    ...graphSnapshot,
    nodes: graphSnapshot.nodes.map((node) => {
      if (node.componentType !== 'builtin.file-tree') {
        return node;
      }

      const rootDir =
        typeof node.config.rootDir === 'string'
          ? sanitizePathWithinRoot(workspaceRootDir, node.config.rootDir)
          : workspaceRootDir;

      return {
        ...node,
        config: {
          ...node.config,
          rootDir
        }
      };
    })
  };
};

export const createCanvasIpcHandlers = (deps: CanvasIpcDependencies): CanvasIpcHandlers => {
  return {
    load: async (_event: IpcMainInvokeEvent, input: CanvasLoadInput) => {
      const parsed = canvasLoadSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const workspaceRootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const loadedState = deps.getWorkspaceRepository(parsed.workspaceId).loadCanvasState();
      return {
        state: sanitizeCanvasStateForWorkspace(loadedState, workspaceRootDir)
      };
    },
    save: async (_event: IpcMainInvokeEvent, input: CanvasSaveInput) => {
      const parsed = canvasSaveSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const workspaceRootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const sanitizedState = sanitizeCanvasStateForWorkspace(parsed.state, workspaceRootDir);
      return {
        state: deps.getWorkspaceRepository(parsed.workspaceId).saveCanvasState(sanitizedState)
      };
    },
    graphLoad: async (_event: IpcMainInvokeEvent, input: GraphLoadV2Input) => {
      const parsed = graphLoadSchemaV2.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const workspaceRootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const loadedGraph = deps.getWorkspaceRepository(parsed.workspaceId).loadGraphSnapshot();
      return {
        graphSnapshot: sanitizeGraphSnapshotForWorkspace(loadedGraph, workspaceRootDir)
      };
    },
    graphSave: async (_event: IpcMainInvokeEvent, input: GraphSaveV2Input) => {
      const parsed = graphSaveSchemaV2.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const workspaceRootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const sanitizedGraph = sanitizeGraphSnapshotForWorkspace(parsed.graphSnapshot, workspaceRootDir);
      return {
        graphSnapshot: deps.getWorkspaceRepository(parsed.workspaceId).saveGraphSnapshot(
          sanitizedGraph
        )
      };
    }
  };
};

interface RegisteredCanvasIpcContext {
  workspaceDbDir: string;
  registryDbFilePath: string;
  registry: RegistryRepository;
  repositories: Map<string, WorkspaceRepository>;
}

let registeredCanvasIpcContext: RegisteredCanvasIpcContext | null = null;
const MAX_OPEN_WORKSPACE_REPOSITORIES = 24;

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const resetCanvasContext = (
  workspaceDbDir: string,
  registryDbFilePath: string
): RegisteredCanvasIpcContext => {
  const shouldReset =
    registeredCanvasIpcContext &&
    (registeredCanvasIpcContext.workspaceDbDir !== workspaceDbDir ||
      registeredCanvasIpcContext.registryDbFilePath !== registryDbFilePath);

  if (shouldReset && registeredCanvasIpcContext) {
    for (const repository of registeredCanvasIpcContext.repositories.values()) {
      repository.close();
    }
    registeredCanvasIpcContext.registry.close();
    registeredCanvasIpcContext = null;
  }

  if (!registeredCanvasIpcContext) {
    registeredCanvasIpcContext = {
      workspaceDbDir,
      registryDbFilePath,
      registry: createRegistryRepository({ dbFilePath: registryDbFilePath }),
      repositories: new Map<string, WorkspaceRepository>()
    };
  }

  return registeredCanvasIpcContext;
};

const resolveWorkspaceRepository = (
  workspaceId: string,
  workspaceDbDir: string,
  registryDbFilePath: string
): WorkspaceRepository => {
  const context = resetCanvasContext(workspaceDbDir, registryDbFilePath);
  const existing = context.repositories.get(workspaceId);
  if (existing) {
    context.repositories.delete(workspaceId);
    context.repositories.set(workspaceId, existing);
    return existing;
  }

  if (context.repositories.size >= MAX_OPEN_WORKSPACE_REPOSITORIES) {
    const lru = context.repositories.entries().next().value;
    if (lru) {
      const [oldWorkspaceId, oldRepository] = lru;
      oldRepository.close();
      context.repositories.delete(oldWorkspaceId);
    }
  }

  const repository = createWorkspaceRepository({
    dbFilePath: path.join(context.workspaceDbDir, `${toWorkspaceDbFileName(workspaceId)}.db`)
  });
  context.repositories.set(workspaceId, repository);
  return repository;
};

const assertWorkspaceExists = (
  workspaceId: string,
  workspaceDbDir: string,
  registryDbFilePath: string
): void => {
  const context = resetCanvasContext(workspaceDbDir, registryDbFilePath);
  if (!context.registry.hasWorkspace(workspaceId)) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
};

const resolveIpcMain = (): CanvasIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

export interface RegisterCanvasIpcHandlersOptions {
  workspaceDbDir: string;
  registryDbFilePath: string;
  ipcMain?: CanvasIpcMain;
}

export const registerCanvasIpcHandlers = (options: RegisterCanvasIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const handlers = createCanvasIpcHandlers({
    assertWorkspaceExists: (workspaceId: string) =>
      assertWorkspaceExists(workspaceId, options.workspaceDbDir, options.registryDbFilePath),
    resolveWorkspaceRootDir: (workspaceId: string) =>
      resetCanvasContext(options.workspaceDbDir, options.registryDbFilePath).registry.getWorkspace(
        workspaceId
      ).rootDir,
    getWorkspaceRepository: (workspaceId: string) =>
      resolveWorkspaceRepository(workspaceId, options.workspaceDbDir, options.registryDbFilePath)
  });

  ipcMain.removeHandler(IPC_CHANNELS.canvasLoad);
  ipcMain.removeHandler(IPC_CHANNELS.canvasSave);
  ipcMain.removeHandler(IPC_CHANNELS.graphLoad);
  ipcMain.removeHandler(IPC_CHANNELS.graphSave);

  ipcMain.handle(IPC_CHANNELS.canvasLoad, handlers.load);
  ipcMain.handle(IPC_CHANNELS.canvasSave, handlers.save);
  ipcMain.handle(IPC_CHANNELS.graphLoad, handlers.graphLoad);
  ipcMain.handle(IPC_CHANNELS.graphSave, handlers.graphSave);
};

export const disposeCanvasWorkspaceRepository = (workspaceId: string): void => {
  if (!registeredCanvasIpcContext) {
    return;
  }

  const repository = registeredCanvasIpcContext.repositories.get(workspaceId);
  if (!repository) {
    return;
  }

  repository.close();
  registeredCanvasIpcContext.repositories.delete(workspaceId);
};

export const disposeCanvasIpcHandlers = (): void => {
  if (!registeredCanvasIpcContext) {
    return;
  }

  for (const repository of registeredCanvasIpcContext.repositories.values()) {
    repository.close();
  }
  registeredCanvasIpcContext.registry.close();
  registeredCanvasIpcContext = null;
};
