import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, type WorkspaceMutationResponse } from '../../shared/ipc/contracts';
import {
  workspaceBranchCreateSchema,
  workspaceIdSchema,
  type WorkspaceBranchCreateInput
} from '../../shared/ipc/schemas';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { createWorkspaceRepository } from '../db/workspace';
import type { PortalSessionRecord } from '../../shared/portal/types';
import type { PortalSessionService } from '../portal/portal-session-service';
import {
  createGitWorktreeService,
  type GitWorktreeService
} from '../../worker/git/worktree-service';

interface BranchWorkspaceIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export interface BranchWorkspaceIpcHandlers {
  createBranchWorkspace: (
    _event: IpcMainInvokeEvent,
    input: WorkspaceBranchCreateInput
  ) => Promise<WorkspaceMutationResponse>;
  listWorkspacePortalSessions: (workspaceId: string) => PortalSessionRecord[];
}

export interface BranchWorkspaceIpcDependencies {
  registry: RegistryRepository;
  workspaceDbDir: string;
  gitWorktreeService?: GitWorktreeService;
  portalSessionService?: Pick<PortalSessionService, 'listWorkspaceSessions'>;
}

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const resolveWorkspaceDbPath = (workspaceDbDir: string, workspaceId: string): string => {
  return path.join(workspaceDbDir, `${toWorkspaceDbFileName(workspaceId)}.db`);
};

const toBranchWorkspaceName = (sourceWorkspaceName: string, branchName: string): string => {
  return `${sourceWorkspaceName} (${branchName})`;
};

const toBranchWorkspaceRootDir = (sourceRootDir: string, branchName: string): string => {
  const sourceBaseName = path.basename(sourceRootDir);
  const branchPathSegments = branchName
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return path.join(path.dirname(sourceRootDir), '.openweave-worktrees', sourceBaseName, ...branchPathSegments);
};

const isPathInsideRoot = (rootDir: string, candidatePath: string): boolean => {
  const relative = path.relative(rootDir, candidatePath);
  if (relative.length === 0) {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};

const remapFileTreeRootDir = (
  nodeRootDir: string,
  sourceWorkspaceRootDir: string,
  targetWorkspaceRootDir: string
): string => {
  const resolvedSourceRoot = path.resolve(sourceWorkspaceRootDir);
  const resolvedNodeRoot = path.resolve(nodeRootDir);
  if (!isPathInsideRoot(resolvedSourceRoot, resolvedNodeRoot)) {
    return targetWorkspaceRootDir;
  }
  const relative = path.relative(resolvedSourceRoot, resolvedNodeRoot);
  return relative.length === 0 ? targetWorkspaceRootDir : path.join(targetWorkspaceRootDir, relative);
};

const cloneCanvasLayout = (options: {
  workspaceDbDir: string;
  sourceWorkspaceId: string;
  sourceWorkspaceRootDir: string;
  targetWorkspaceId: string;
  targetWorkspaceRootDir: string;
}): void => {
  const sourceRepository = createWorkspaceRepository({
    dbFilePath: resolveWorkspaceDbPath(options.workspaceDbDir, options.sourceWorkspaceId)
  });
  const targetRepository = createWorkspaceRepository({
    dbFilePath: resolveWorkspaceDbPath(options.workspaceDbDir, options.targetWorkspaceId)
  });

  try {
    const sourceCanvas = sourceRepository.loadCanvasState();
    targetRepository.saveCanvasState({
      nodes: sourceCanvas.nodes.map((node) => {
        if (node.type !== 'file-tree') {
          return node;
        }

        return {
          ...node,
          rootDir: remapFileTreeRootDir(
            node.rootDir,
            options.sourceWorkspaceRootDir,
            options.targetWorkspaceRootDir
          )
        };
      }),
      edges: sourceCanvas.edges
    });
  } finally {
    sourceRepository.close();
    targetRepository.close();
  }
};

export const createBranchWorkspaceIpcHandlers = (
  deps: BranchWorkspaceIpcDependencies
): BranchWorkspaceIpcHandlers => {
  const gitWorktreeService = deps.gitWorktreeService ?? createGitWorktreeService();

  return {
    createBranchWorkspace: async (
      _event: IpcMainInvokeEvent,
      input: WorkspaceBranchCreateInput
    ): Promise<WorkspaceMutationResponse> => {
      const parsed = workspaceBranchCreateSchema.parse(input);
      const sourceWorkspace = deps.registry.getWorkspace(parsed.sourceWorkspaceId);
      const sourceRootDir = path.resolve(sourceWorkspace.rootDir);
      const targetRootDir = toBranchWorkspaceRootDir(sourceRootDir, parsed.branchName);

      const worktree = await gitWorktreeService.create({
        sourceDir: sourceRootDir,
        branchName: parsed.branchName,
        targetDir: targetRootDir
      });

      let createdWorkspaceId: string | null = null;
      try {
        const createdWorkspace = deps.registry.createWorkspace({
          name: toBranchWorkspaceName(sourceWorkspace.name, parsed.branchName),
          rootDir: worktree.targetDir
        });
        createdWorkspaceId = createdWorkspace.id;

        if (parsed.copyCanvas) {
          cloneCanvasLayout({
            workspaceDbDir: deps.workspaceDbDir,
            sourceWorkspaceId: sourceWorkspace.id,
            sourceWorkspaceRootDir: sourceRootDir,
            targetWorkspaceId: createdWorkspace.id,
            targetWorkspaceRootDir: worktree.targetDir
          });
        }

        return {
          workspace: createdWorkspace
        };
      } catch (error) {
        if (createdWorkspaceId) {
          deps.registry.deleteWorkspace(createdWorkspaceId);
        }
        throw error;
      }
    },
    listWorkspacePortalSessions: (workspaceId: string): PortalSessionRecord[] => {
      if (!deps.portalSessionService) {
        return [];
      }
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      return deps.portalSessionService.listWorkspaceSessions(parsedWorkspaceId);
    }
  };
};

const resolveIpcMain = (): BranchWorkspaceIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

interface RegisteredBranchWorkspaceContext {
  dbFilePath: string;
  workspaceDbDir: string;
  registry: RegistryRepository;
}

let registeredBranchWorkspaceContext: RegisteredBranchWorkspaceContext | null = null;

const getOrCreateRegistry = (dbFilePath: string, workspaceDbDir: string): RegistryRepository => {
  if (!registeredBranchWorkspaceContext) {
    registeredBranchWorkspaceContext = {
      dbFilePath,
      workspaceDbDir,
      registry: createRegistryRepository({ dbFilePath })
    };
    return registeredBranchWorkspaceContext.registry;
  }

  if (
    registeredBranchWorkspaceContext.dbFilePath !== dbFilePath ||
    registeredBranchWorkspaceContext.workspaceDbDir !== workspaceDbDir
  ) {
    registeredBranchWorkspaceContext.registry.close();
    registeredBranchWorkspaceContext = {
      dbFilePath,
      workspaceDbDir,
      registry: createRegistryRepository({ dbFilePath })
    };
  }

  return registeredBranchWorkspaceContext.registry;
};

export interface RegisterBranchWorkspaceIpcHandlersOptions {
  dbFilePath: string;
  workspaceDbDir: string;
  ipcMain?: BranchWorkspaceIpcMain;
}

export const registerBranchWorkspaceIpcHandlers = (
  options: RegisterBranchWorkspaceIpcHandlersOptions
): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const handlers = createBranchWorkspaceIpcHandlers({
    registry: getOrCreateRegistry(options.dbFilePath, options.workspaceDbDir),
    workspaceDbDir: options.workspaceDbDir
  });

  ipcMain.removeHandler(IPC_CHANNELS.workspaceCreateBranch);
  ipcMain.handle(IPC_CHANNELS.workspaceCreateBranch, handlers.createBranchWorkspace);
};

export const disposeBranchWorkspaceIpcHandlers = (): void => {
  if (!registeredBranchWorkspaceContext) {
    return;
  }

  registeredBranchWorkspaceContext.registry.close();
  registeredBranchWorkspaceContext = null;
};
