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
  createdBranch: boolean;
}

export interface WorktreeCleanupInput {
  sourceDir: string;
  branchName: string;
  targetDir: string;
  removeBranch: boolean;
}

export interface GitWorktreeService {
  create: (input: WorktreeCreateInput) => Promise<WorktreeCreateResult>;
  cleanup: (input: WorktreeCleanupInput) => Promise<void>;
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
    combined.includes('needed a single revision') ||
    combined.includes('unknown revision or path')
  );
};

const isMissingWorktreeError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { stderr?: unknown; message?: unknown };
  const stderr = typeof candidate.stderr === 'string' ? candidate.stderr : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const combined = `${stderr}\n${message}`.toLowerCase();
  return (
    combined.includes('is not a working tree') ||
    combined.includes('does not exist') ||
    combined.includes('no such file') ||
    combined.includes('not found')
  );
};

const isMissingBranchError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { stderr?: unknown; message?: unknown };
  const stderr = typeof candidate.stderr === 'string' ? candidate.stderr : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const combined = `${stderr}\n${message}`.toLowerCase();
  return combined.includes('branch') && combined.includes('not found');
};

const validateBranchNameInput = (branchName: string): void => {
  if (branchName.startsWith('-')) {
    throw new Error('Branch name cannot start with -');
  }
};

const validateBranchNameByGit = async (sourceDir: string, branchName: string): Promise<void> => {
  await runGitCommand({
    rootDir: sourceDir,
    args: ['check-ref-format', '--branch', branchName]
  });
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
      validateBranchNameInput(branchName);

      if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
      }
      await validateBranchNameByGit(sourceDir, branchName);

      ensureTargetDirAvailable(targetDir);
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });

      try {
        await runGitCommand({
          rootDir: sourceDir,
          args: ['rev-parse', '--verify', `refs/heads/${branchName}`]
        });
        throw new Error(`Branch already exists: ${branchName}`);
      } catch (error) {
        if (error instanceof Error && error.message === `Branch already exists: ${branchName}`) {
          throw error;
        }
        if (!isUnknownBranchError(error)) {
          throw error;
        }
      }

      await runGitCommand({
        rootDir: sourceDir,
        args: ['worktree', 'add', '-b', branchName, targetDir, 'HEAD']
      });

      return {
        sourceDir,
        branchName,
        targetDir,
        createdBranch: true
      };
    },
    cleanup: async (input: WorktreeCleanupInput): Promise<void> => {
      const sourceDir = path.resolve(parseNonEmpty(input.sourceDir, 'Source directory'));
      const targetDir = path.resolve(parseNonEmpty(input.targetDir, 'Target directory'));
      const branchName = parseNonEmpty(input.branchName, 'Branch name');
      validateBranchNameInput(branchName);

      if (fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory()) {
        try {
          await runGitCommand({
            rootDir: sourceDir,
            args: ['worktree', 'remove', '--force', targetDir]
          });
        } catch (error) {
          if (!isMissingWorktreeError(error)) {
            throw error;
          }
        }

        if (input.removeBranch) {
          try {
            await runGitCommand({
              rootDir: sourceDir,
              args: ['branch', '-D', branchName]
            });
          } catch (error) {
            if (!isMissingBranchError(error)) {
              throw error;
            }
          }
        }
      }

      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    }
  };
};
