import fs from 'node:fs';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type FileTreeEntryRecord,
  type FileTreeLoadResponse,
  type GitFileStatusCode,
  type GitStatusSummaryRecord
} from '../../shared/ipc/contracts';
import { fileTreeLoadSchema, type FileTreeLoadInput } from '../../shared/ipc/schemas';
import { scanTree, type FileTreeScanEntry } from '../../worker/fs/file-tree-service';
import { gitStatus, type GitStatusResult } from '../../worker/git/git-service';

interface FilesIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export interface FilesIpcHandlers {
  loadFileTree: (_event: IpcMainInvokeEvent, input: FileTreeLoadInput) => Promise<FileTreeLoadResponse>;
}

export interface FilesIpcDependencies {
  scanTree: (rootDir: string) => Promise<FileTreeScanEntry[]>;
  gitStatus: (rootDir: string) => Promise<GitStatusResult>;
}

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

const parseRootDir = (rootDir: string): string => {
  const trimmed = rootDir.trim();
  if (trimmed.length === 0) {
    throw new Error('Root directory is required');
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    throw new Error('Root directory must be a local filesystem path');
  }

  const resolved = path.resolve(trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Root directory does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`Root path is not a directory: ${resolved}`);
  }
  return resolved;
};

export const createFilesIpcHandlers = (deps?: Partial<FilesIpcDependencies>): FilesIpcHandlers => {
  const scanTreeFn = deps?.scanTree ?? ((rootDir: string) => scanTree(rootDir));
  const gitStatusFn = deps?.gitStatus ?? ((rootDir: string) => gitStatus(rootDir));

  return {
    loadFileTree: async (_event: IpcMainInvokeEvent, input: FileTreeLoadInput) => {
      const parsed = fileTreeLoadSchema.parse(input);
      const resolvedRootDir = parseRootDir(parsed.rootDir);
      const [entries, git] = await Promise.all([scanTreeFn(resolvedRootDir), gitStatusFn(resolvedRootDir)]);

      return {
        rootDir: resolvedRootDir,
        readOnly: true,
        isGitRepo: git.isGitRepo,
        gitSummary: summarizeGitStatuses(git.statuses),
        entries: mergeTreeWithGitStatus(entries, git.statuses)
      };
    }
  };
};

const resolveIpcMain = (): FilesIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

export interface RegisterFilesIpcHandlersOptions {
  ipcMain?: FilesIpcMain;
}

export const registerFilesIpcHandlers = (options: RegisterFilesIpcHandlersOptions = {}): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const handlers = createFilesIpcHandlers();

  ipcMain.removeHandler(IPC_CHANNELS.fileTreeLoad);
  ipcMain.handle(IPC_CHANNELS.fileTreeLoad, handlers.loadFileTree);
};
