import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitFileStatusCode } from '../../shared/ipc/contracts';

const execFileAsync = promisify(execFile);

export interface GitStatusResult {
  isGitRepo: boolean;
  statuses: Map<string, GitFileStatusCode>;
}

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

export interface RunGitCommandOptions {
  rootDir: string;
  args: string[];
}

const normalizeStatusPath = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\/g, '/');
  }
  return trimmed.replace(/\\/g, '/');
};

const toPrimaryStatus = (xy: string): GitFileStatusCode | null => {
  const indexStatus = xy[0] ?? ' ';
  const worktreeStatus = xy[1] ?? ' ';

  if (indexStatus === '?' || worktreeStatus === '?') {
    return '?';
  }
  if (indexStatus === '!' || worktreeStatus === '!') {
    return '!';
  }
  if (indexStatus !== ' ') {
    return indexStatus as GitFileStatusCode;
  }
  if (worktreeStatus !== ' ') {
    return worktreeStatus as GitFileStatusCode;
  }
  return null;
};

const parsePorcelainStatus = (stdout: string): Map<string, GitFileStatusCode> => {
  const statuses = new Map<string, GitFileStatusCode>();
  const lines = stdout.split('\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.length < 3) {
      continue;
    }

    const xy = line.slice(0, 2);
    const status = toPrimaryStatus(xy);
    if (!status) {
      continue;
    }

    const rawPath = line.slice(3);
    const renamedParts = rawPath.split(' -> ');
    const targetPath = renamedParts[renamedParts.length - 1] ?? rawPath;
    const normalizedPath = normalizeStatusPath(targetPath);
    if (normalizedPath.length === 0) {
      continue;
    }

    statuses.set(normalizedPath, status);
  }

  return statuses;
};

const isNotGitRepositoryError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { stderr?: unknown; message?: unknown };
  const stderr = typeof candidate.stderr === 'string' ? candidate.stderr : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const content = `${stderr}\n${message}`.toLowerCase();
  return content.includes('not a git repository');
};

export const runGitCommand = async (options: RunGitCommandOptions): Promise<GitCommandResult> => {
  const result = await execFileAsync('git', ['-C', options.rootDir, ...options.args], {
    env: {
      ...process.env,
      LC_ALL: 'C'
    },
    windowsHide: true
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
};

export const gitStatus = async (rootDir: string): Promise<GitStatusResult> => {
  try {
    const result = await runGitCommand({
      rootDir,
      args: ['status', '--porcelain', '--untracked-files=all']
    });

    return {
      isGitRepo: true,
      statuses: parsePorcelainStatus(result.stdout)
    };
  } catch (error) {
    if (isNotGitRepositoryError(error)) {
      return {
        isGitRepo: false,
        statuses: new Map<string, GitFileStatusCode>()
      };
    }
    throw error;
  }
};
