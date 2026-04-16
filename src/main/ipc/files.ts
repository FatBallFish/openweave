import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fork, type ChildProcess } from 'node:child_process';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type FileTreeEntryRecord,
  type FileTreeLoadResponse,
  type GitFileStatusCode,
  type GitStatusSummaryRecord
} from '../../shared/ipc/contracts';
import { fileTreeLoadSchema, type FileTreeLoadInput } from '../../shared/ipc/schemas';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { isPathWithinRoot, parseLocalDirectoryPath } from '../workspace/path-boundary';
import { scanTree, type FileTreeScanEntry } from '../../worker/fs/file-tree-service';
import { gitStatus } from '../../worker/git/git-service';

interface FilesIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export interface FilesIpcHandlers {
  loadFileTree: (_event: IpcMainInvokeEvent, input: FileTreeLoadInput) => Promise<FileTreeLoadResponse>;
}

interface FileTreeLoadResult {
  entries: FileTreeScanEntry[];
  isGitRepo: boolean;
  statuses: Map<string, GitFileStatusCode>;
}

export interface FilesIpcDependencies {
  resolveWorkspaceRootDir: (workspaceId: string) => string;
  loadTreeForRootDir: (rootDir: string) => Promise<FileTreeLoadResult>;
}

interface FileTreeWorkerRequest {
  requestId: string;
  rootDir: string;
}

interface FileTreeWorkerResponseSuccess {
  requestId: string;
  ok: true;
  payload: {
    entries: FileTreeScanEntry[];
    isGitRepo: boolean;
    statuses: Record<string, string>;
  };
}

interface FileTreeWorkerResponseError {
  requestId: string;
  ok: false;
  error: string;
}

type FileTreeWorkerResponse = FileTreeWorkerResponseSuccess | FileTreeWorkerResponseError;

const FILE_TREE_WORKER_TIMEOUT_MS = 20_000;

const createEmptyGitSummary = (): GitStatusSummaryRecord => {
  return {
    modified: 0,
    added: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    unmerged: 0,
    untracked: 0,
    ignored: 0
  };
};

const summarizeGitStatuses = (statuses: Map<string, GitFileStatusCode>): GitStatusSummaryRecord => {
  const summary = createEmptyGitSummary();
  for (const status of statuses.values()) {
    if (status === 'M') {
      summary.modified += 1;
    } else if (status === 'A') {
      summary.added += 1;
    } else if (status === 'D') {
      summary.deleted += 1;
    } else if (status === 'R') {
      summary.renamed += 1;
    } else if (status === 'C') {
      summary.copied += 1;
    } else if (status === 'U') {
      summary.unmerged += 1;
    } else if (status === '?') {
      summary.untracked += 1;
    } else if (status === '!') {
      summary.ignored += 1;
    }
  }
  return summary;
};

const mergeTreeWithGitStatus = (
  entries: FileTreeScanEntry[],
  statuses: Map<string, GitFileStatusCode>
): FileTreeEntryRecord[] => {
  return entries.map((entry) => {
    if (entry.kind === 'directory') {
      return {
        ...entry,
        gitStatus: null
      };
    }

    return {
      ...entry,
      gitStatus: statuses.get(entry.path) ?? null
    };
  });
};

const loadTreeInProcess = async (rootDir: string): Promise<FileTreeLoadResult> => {
  const [entries, git] = await Promise.all([scanTree(rootDir), gitStatus(rootDir)]);
  return {
    entries,
    isGitRepo: git.isGitRepo,
    statuses: git.statuses
  };
};

const resolveWorkerEntryPath = (): string => {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'worker', 'fs', 'file-tree-worker.js'),
    path.resolve(process.cwd(), 'dist/worker/fs/file-tree-worker.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('File tree worker entry is missing');
};

const terminateChild = (child: ChildProcess): void => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    child.kill();
  } catch {
    // Ignore kill errors during cleanup.
  }
};

const toStatusMap = (input: Record<string, string>): Map<string, GitFileStatusCode> => {
  const statuses = new Map<string, GitFileStatusCode>();
  for (const [entryPath, rawStatus] of Object.entries(input)) {
    if (
      rawStatus === 'M' ||
      rawStatus === 'A' ||
      rawStatus === 'D' ||
      rawStatus === 'R' ||
      rawStatus === 'C' ||
      rawStatus === 'U' ||
      rawStatus === '?' ||
      rawStatus === '!'
    ) {
      statuses.set(entryPath, rawStatus);
    }
  }
  return statuses;
};

const loadTreeInWorkerProcess = async (rootDir: string): Promise<FileTreeLoadResult> => {
  const workerEntryPath = resolveWorkerEntryPath();

  return new Promise<FileTreeLoadResult>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const child = fork(workerEntryPath, [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: process.env,
      execArgv: []
    });
    let completed = false;

    const cleanup = (): void => {
      child.removeAllListeners('message');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      clearTimeout(timeoutHandle);
      terminateChild(child);
    };

    const finish = (fn: () => void): void => {
      if (completed) {
        return;
      }
      completed = true;
      cleanup();
      fn();
    };

    const timeoutHandle = setTimeout(() => {
      finish(() => {
        reject(new Error(`File tree worker timed out after ${FILE_TREE_WORKER_TIMEOUT_MS}ms`));
      });
    }, FILE_TREE_WORKER_TIMEOUT_MS);

    child.on('message', (message: unknown) => {
      const response = message as FileTreeWorkerResponse | undefined;
      if (!response || typeof response.requestId !== 'string' || response.requestId !== requestId) {
        return;
      }

      if (!response.ok) {
        finish(() => {
          reject(new Error(response.error));
        });
        return;
      }

      finish(() => {
        resolve({
          entries: response.payload.entries,
          isGitRepo: response.payload.isGitRepo,
          statuses: toStatusMap(response.payload.statuses)
        });
      });
    });

    child.on('error', (error: Error) => {
      finish(() => {
        reject(error);
      });
    });

    child.on('exit', (code, signal) => {
      if (completed) {
        return;
      }
      finish(() => {
        reject(
          new Error(
            `File tree worker exited before response (code=${String(code)}, signal=${String(signal)})`
          )
        );
      });
    });

    const request: FileTreeWorkerRequest = {
      requestId,
      rootDir
    };
    child.send(request);
  });
};

export const createFilesIpcHandlers = (deps: FilesIpcDependencies): FilesIpcHandlers => {
  return {
    loadFileTree: async (_event: IpcMainInvokeEvent, input: FileTreeLoadInput) => {
      const parsed = fileTreeLoadSchema.parse(input);
      const workspaceRootDir = parseLocalDirectoryPath(deps.resolveWorkspaceRootDir(parsed.workspaceId), {
        requireExists: false
      });
      const resolvedRootDir = parseLocalDirectoryPath(parsed.rootDir, { requireExists: true });

      if (!isPathWithinRoot(workspaceRootDir, resolvedRootDir)) {
        throw new Error('Root directory must stay within workspace root');
      }

      const loadedTree = await deps.loadTreeForRootDir(resolvedRootDir);
      return {
        rootDir: resolvedRootDir,
        readOnly: true,
        isGitRepo: loadedTree.isGitRepo,
        gitSummary: summarizeGitStatuses(loadedTree.statuses),
        entries: mergeTreeWithGitStatus(loadedTree.entries, loadedTree.statuses)
      };
    }
  };
};

const resolveIpcMain = (): FilesIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

interface RegisteredFilesContext {
  dbFilePath: string;
  registry: RegistryRepository;
}

let registeredFilesContext: RegisteredFilesContext | null = null;

const getOrCreateFilesRegistry = (dbFilePath: string): RegistryRepository => {
  if (!registeredFilesContext) {
    registeredFilesContext = {
      dbFilePath,
      registry: createRegistryRepository({ dbFilePath })
    };
    return registeredFilesContext.registry;
  }

  if (registeredFilesContext.dbFilePath !== dbFilePath) {
    registeredFilesContext.registry.close();
    registeredFilesContext = {
      dbFilePath,
      registry: createRegistryRepository({ dbFilePath })
    };
  }

  return registeredFilesContext.registry;
};

export interface RegisterFilesIpcHandlersOptions {
  dbFilePath: string;
  ipcMain?: FilesIpcMain;
}

export const registerFilesIpcHandlers = (options: RegisterFilesIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const registry = getOrCreateFilesRegistry(options.dbFilePath);
  const handlers = createFilesIpcHandlers({
    resolveWorkspaceRootDir: (workspaceId: string) => registry.getWorkspace(workspaceId).rootDir,
    loadTreeForRootDir: loadTreeInWorkerProcess
  });

  ipcMain.removeHandler(IPC_CHANNELS.fileTreeLoad);
  ipcMain.handle(IPC_CHANNELS.fileTreeLoad, handlers.loadFileTree);
};

export const disposeFilesIpcHandlers = (): void => {
  if (!registeredFilesContext) {
    return;
  }
  registeredFilesContext.registry.close();
  registeredFilesContext = null;
};

export const loadFileTreeForTestsOnly = loadTreeInProcess;
