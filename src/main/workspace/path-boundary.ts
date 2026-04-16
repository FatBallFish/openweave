import fs from 'node:fs';
import path from 'node:path';

const urlLikePrefixPattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

const canonicalizePath = (inputPath: string): string => {
  const resolved = path.resolve(inputPath);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
};

export const parseLocalDirectoryPath = (
  inputPath: string,
  options: { requireExists: boolean }
): string => {
  const trimmed = inputPath.trim();
  if (trimmed.length === 0) {
    throw new Error('Root directory is required');
  }
  if (urlLikePrefixPattern.test(trimmed)) {
    throw new Error('Root directory must be a local filesystem path');
  }

  const canonicalPath = canonicalizePath(trimmed);
  if (options.requireExists) {
    if (!fs.existsSync(canonicalPath)) {
      throw new Error(`Root directory does not exist: ${canonicalPath}`);
    }
    if (!fs.statSync(canonicalPath).isDirectory()) {
      throw new Error(`Root path is not a directory: ${canonicalPath}`);
    }
  }

  return canonicalPath;
};

export const isPathWithinRoot = (rootDir: string, candidatePath: string): boolean => {
  const canonicalRoot = canonicalizePath(rootDir);
  const canonicalCandidate = canonicalizePath(candidatePath);
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  if (relative.length === 0) {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};

export const sanitizePathWithinRoot = (rootDir: string, candidatePath: string): string => {
  const canonicalRoot = canonicalizePath(rootDir);
  let canonicalCandidate = canonicalRoot;
  try {
    canonicalCandidate = parseLocalDirectoryPath(candidatePath, { requireExists: false });
  } catch {
    return canonicalRoot;
  }
  if (!isPathWithinRoot(canonicalRoot, canonicalCandidate)) {
    return canonicalRoot;
  }
  return canonicalCandidate;
};
