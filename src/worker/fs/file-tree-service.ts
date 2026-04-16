import fs from 'node:fs/promises';
import path from 'node:path';

export interface FileTreeScanEntry {
  path: string;
  kind: 'file' | 'directory';
}

export const DEFAULT_IGNORED_GLOBS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage'
] as const;

const toPosixPath = (input: string): string => {
  return input.split(path.sep).join('/');
};

const scanDirectory = async (
  rootDir: string,
  currentDir: string,
  ignoredNames: Set<string>,
  entries: FileTreeScanEntry[]
): Promise<void> => {
  const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
  dirEntries.sort((left, right) => left.name.localeCompare(right.name));

  for (const dirEntry of dirEntries) {
    const absolutePath = path.join(currentDir, dirEntry.name);
    const relativePath = toPosixPath(path.relative(rootDir, absolutePath));

    if (relativePath.length === 0) {
      continue;
    }

    if (dirEntry.isDirectory()) {
      if (ignoredNames.has(dirEntry.name)) {
        continue;
      }
      entries.push({ path: relativePath, kind: 'directory' });
      await scanDirectory(rootDir, absolutePath, ignoredNames, entries);
      continue;
    }

    if (!dirEntry.isFile()) {
      continue;
    }

    entries.push({ path: relativePath, kind: 'file' });
  }
};

export const scanTree = async (
  rootDir: string,
  ignoredNamesInput: readonly string[] = DEFAULT_IGNORED_GLOBS
): Promise<FileTreeScanEntry[]> => {
  const ignoredNames = new Set<string>(ignoredNamesInput);
  const entries: FileTreeScanEntry[] = [];
  await scanDirectory(rootDir, rootDir, ignoredNames, entries);
  return entries;
};
