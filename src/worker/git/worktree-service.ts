import fs from 'node:fs';
import path from 'node:path';
import { runGitCommand } from './git-service';

export interface WorktreeCreateInput {
  sourceDir: string;
  branchName: string;
  targetDir: string;
}

export interface WorktreeCreateResult {
  sourceDir: string;
  branchName: string;
  targetDir: string;
}

export interface GitWorktreeService {
  create: (input: WorktreeCreateInput) => Promise<WorktreeCreateResult>;
}

const parseNonEmpty = (value: string, fieldName: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
};

const isUnknownBranchError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { stderr?: unknown; message?: unknown };
  const stderr = typeof candidate.stderr === 'string' ? candidate.stderr : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const combined = `${stderr}\n${message}`.toLowerCase();
  return (
    combined.includes('unknown revision') ||
    combined.includes('not a valid ref') ||
    combined.includes('needed a single revision')
  );
};

const ensureTargetDirAvailable = (targetDir: string): void => {
  if (!fs.existsSync(targetDir)) {
    return;
  }

  if (!fs.statSync(targetDir).isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  const entries = fs.readdirSync(targetDir);
  if (entries.length > 0) {
    throw new Error(`Target directory must be empty: ${targetDir}`);
  }
};

export const createGitWorktreeService = (): GitWorktreeService => {
  return {
    create: async (input: WorktreeCreateInput): Promise<WorktreeCreateResult> => {
      const sourceDir = path.resolve(parseNonEmpty(input.sourceDir, 'Source directory'));
      const branchName = parseNonEmpty(input.branchName, 'Branch name');
      const targetDir = path.resolve(parseNonEmpty(input.targetDir, 'Target directory'));

      if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
      }

      ensureTargetDirAvailable(targetDir);
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });

      let branchExists = false;
      try {
        await runGitCommand({
          rootDir: sourceDir,
          args: ['rev-parse', '--verify', `refs/heads/${branchName}`]
        });
        branchExists = true;
      } catch (error) {
        if (!isUnknownBranchError(error)) {
          throw error;
        }
      }

      await runGitCommand({
        rootDir: sourceDir,
        args: branchExists
          ? ['worktree', 'add', targetDir, branchName]
          : ['worktree', 'add', '-b', branchName, targetDir, 'HEAD']
      });

      return {
        sourceDir,
        branchName,
        targetDir
      };
    }
  };
};
