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

const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;

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

const isExitCode = (error: unknown, expectedCode: number): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { code?: unknown };
  if (typeof candidate.code === 'number') {
    return candidate.code === expectedCode;
  }
  if (typeof candidate.code === 'string') {
    const parsed = Number.parseInt(candidate.code, 10);
    return Number.isFinite(parsed) && parsed === expectedCode;
  }
  return false;
};

const validateBranchNameInput = (branchName: string): string => {
  const normalized = parseNonEmpty(branchName, 'Branch name');
  if (!BRANCH_NAME_PATTERN.test(normalized)) {
    throw new Error('Branch name contains unsupported characters');
  }
  if (normalized.startsWith('/') || normalized.endsWith('/')) {
    throw new Error('Branch name cannot start or end with /');
  }
  if (normalized.startsWith('-')) {
    throw new Error('Branch name cannot start with -');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error('Branch name contains unsupported path segments');
  }
  return normalized;
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

const toBranchPathSegments = (branchName: string): string[] => {
  return validateBranchNameInput(branchName).split('/');
};

export const toManagedWorktreeTargetDir = (sourceDir: string, branchName: string): string => {
  const resolvedSourceDir = path.resolve(parseNonEmpty(sourceDir, 'Source directory'));
  const sourceBaseName = path.basename(resolvedSourceDir);
  return path.join(
    path.dirname(resolvedSourceDir),
    '.openweave-worktrees',
    sourceBaseName,
    ...toBranchPathSegments(branchName)
  );
};

const toPathVariants = (inputPath: string): Set<string> => {
  const resolvedPath = path.resolve(inputPath);
  const variants = new Set<string>([resolvedPath]);
  try {
    variants.add(fs.realpathSync.native(resolvedPath));
  } catch {
    // Keep best-effort normalization when the path does not exist.
  }
  return variants;
};

const listWorktreePaths = async (sourceDir: string): Promise<Set<string>> => {
  const result = await runGitCommand({
    rootDir: sourceDir,
    args: ['worktree', 'list', '--porcelain']
  });
  const worktreePaths = new Set<string>();
  for (const line of result.stdout.split('\n')) {
    if (!line.startsWith('worktree ')) {
      continue;
    }
    const worktreePath = line.slice('worktree '.length).trim();
    if (worktreePath.length > 0) {
      for (const variant of toPathVariants(worktreePath)) {
        worktreePaths.add(variant);
      }
    }
  }
  return worktreePaths;
};

const branchExists = async (sourceDir: string, branchName: string): Promise<boolean> => {
  try {
    await runGitCommand({
      rootDir: sourceDir,
      args: ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]
    });
    return true;
  } catch (error) {
    if (isExitCode(error, 1) || isMissingBranchError(error)) {
      return false;
    }
    throw error;
  }
};

export const createGitWorktreeService = (): GitWorktreeService => {
  return {
    create: async (input: WorktreeCreateInput): Promise<WorktreeCreateResult> => {
      const sourceDir = path.resolve(parseNonEmpty(input.sourceDir, 'Source directory'));
      const branchName = validateBranchNameInput(input.branchName);
      const targetDir = path.resolve(parseNonEmpty(input.targetDir, 'Target directory'));
      const expectedTargetDir = toManagedWorktreeTargetDir(sourceDir, branchName);
      if (targetDir !== expectedTargetDir) {
        throw new Error(`Target directory is outside managed branch-worktree path: ${targetDir}`);
      }

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
      const branchName = validateBranchNameInput(input.branchName);
      const expectedTargetDir = toManagedWorktreeTargetDir(sourceDir, branchName);
      if (targetDir !== expectedTargetDir) {
        throw new Error(
          `Refusing cleanup for unmanaged target directory: ${targetDir}. Expected: ${expectedTargetDir}`
        );
      }

      if (fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory()) {
        const worktreePaths = await listWorktreePaths(sourceDir);
        const targetVariants = toPathVariants(targetDir);
        const targetIsRegistered = Array.from(targetVariants).some((variant) =>
          worktreePaths.has(variant)
        );
        if (targetIsRegistered) {
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
        }

        if (input.removeBranch && (await branchExists(sourceDir, branchName))) {
          await runGitCommand({
            rootDir: sourceDir,
            args: ['branch', '-D', branchName]
          });
        }
      }

      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    }
  };
};
