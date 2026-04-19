import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type WorkspaceMutationResponse,
  type WorkspaceRecord
} from '../../shared/ipc/contracts';
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
  toManagedWorktreeTargetDir,
  type GitWorktreeService
} from '../../worker/git/worktree-service';
import type { GraphSnapshotV2Input } from '../../shared/ipc/schemas';

interface BranchWorkspaceIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export interface BranchWorkspaceIpcHandlers {
  createBranchWorkspace: (
    _event: IpcMainInvokeEvent,
    input: WorkspaceBranchCreateInput
  ) => Promise<WorkspaceMutationResponse>;
  cleanupBranchWorkspaceOnDelete: (workspaceId: string) => Promise<void>;
  listWorkspacePortalSessions: (workspaceId: string) => PortalSessionRecord[];
}

export interface BranchWorkspaceIpcDependencies {
  registry: RegistryRepository;
  workspaceDbDir: string;
  gitWorktreeService?: GitWorktreeService;
  portalSessionService?: Pick<PortalSessionService, 'listWorkspaceSessions'>;
  cloneCanvasLayout?: (options: {
    workspaceDbDir: string;
    sourceWorkspaceId: string;
    sourceWorkspaceRootDir: string;
    targetWorkspaceId: string;
    targetWorkspaceRootDir: string;
  }) => void;
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
  return toManagedWorktreeTargetDir(sourceRootDir, branchName);
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

const remapGraphSnapshotForBranchWorkspace = (
  graphSnapshot: GraphSnapshotV2Input,
  sourceWorkspaceRootDir: string,
  targetWorkspaceRootDir: string
): GraphSnapshotV2Input => {
  return {
    ...graphSnapshot,
    nodes: graphSnapshot.nodes.map((node) => {
      if (node.componentType !== 'builtin.file-tree') {
        return node;
      }

      const rootDir =
        typeof node.config.rootDir === 'string'
          ? remapFileTreeRootDir(
              node.config.rootDir,
              sourceWorkspaceRootDir,
              targetWorkspaceRootDir
            )
          : targetWorkspaceRootDir;

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
    const sourceGraphSnapshot = sourceRepository.loadGraphSnapshot();
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
    targetRepository.saveGraphSnapshot(
      remapGraphSnapshotForBranchWorkspace(
        sourceGraphSnapshot,
        options.sourceWorkspaceRootDir,
        options.targetWorkspaceRootDir
      )
    );
  } finally {
    sourceRepository.close();
    targetRepository.close();
  }
};

export const createBranchWorkspaceIpcHandlers = (
  deps: BranchWorkspaceIpcDependencies
): BranchWorkspaceIpcHandlers => {
  const gitWorktreeService = deps.gitWorktreeService ?? createGitWorktreeService();
  const cloneCanvasLayoutHandler = deps.cloneCanvasLayout ?? cloneCanvasLayout;

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
        deps.registry.upsertBranchWorkspaceLink({
          workspaceId: createdWorkspace.id,
          sourceWorkspaceId: sourceWorkspace.id,
          branchName: worktree.branchName,
          sourceRootDir,
          targetRootDir: worktree.targetDir
        });

        if (parsed.copyCanvas) {
          cloneCanvasLayoutHandler({
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
        await gitWorktreeService.cleanup({
          sourceDir: worktree.sourceDir,
          branchName: worktree.branchName,
          targetDir: worktree.targetDir,
          removeBranch: worktree.createdBranch
        });
        throw error;
      }
    },
    cleanupBranchWorkspaceOnDelete: async (workspaceId: string): Promise<void> => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const link = deps.registry.getBranchWorkspaceLink(parsedWorkspaceId);
      if (!link) {
        return;
      }

      await gitWorktreeService.cleanup({
        sourceDir: link.sourceRootDir,
        branchName: link.branchName,
        targetDir: link.targetRootDir,
        removeBranch: true
      });
      deps.registry.deleteBranchWorkspaceLink(parsedWorkspaceId);
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
  handlers?: BranchWorkspaceIpcHandlers;
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
  const registry = getOrCreateRegistry(options.dbFilePath, options.workspaceDbDir);
  const handlers = createBranchWorkspaceIpcHandlers({
    registry,
    workspaceDbDir: options.workspaceDbDir
  });
  registeredBranchWorkspaceContext = {
    dbFilePath: options.dbFilePath,
    workspaceDbDir: options.workspaceDbDir,
    registry,
    handlers
  };

  ipcMain.removeHandler(IPC_CHANNELS.workspaceCreateBranch);
  ipcMain.handle(IPC_CHANNELS.workspaceCreateBranch, handlers.createBranchWorkspace);
};

export const cleanupRegisteredBranchWorkspaceOnDelete = async (
  workspace: Pick<WorkspaceRecord, 'id'>
): Promise<void> => {
  if (!registeredBranchWorkspaceContext) {
    return;
  }
  if (!registeredBranchWorkspaceContext.handlers) {
    return;
  }
  await registeredBranchWorkspaceContext.handlers.cleanupBranchWorkspaceOnDelete(workspace.id);
};

export const disposeBranchWorkspaceIpcHandlers = (): void => {
  if (!registeredBranchWorkspaceContext) {
    return;
  }

  registeredBranchWorkspaceContext.registry.close();
  registeredBranchWorkspaceContext = null;
};
