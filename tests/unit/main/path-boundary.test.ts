import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isPathWithinRoot,
  parseLocalDirectoryPath,
  sanitizePathWithinRoot
} from '../../../src/main/workspace/path-boundary';

const createdPaths: string[] = [];

const mkdtemp = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdPaths.push(dir);
  return dir;
};

afterEach(() => {
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('path boundary helpers', () => {
  it('parses existing local directories and rejects invalid inputs', () => {
    const rootDir = mkdtemp('openweave-path-root-');
    const filePath = path.join(rootDir, 'file.txt');
    fs.writeFileSync(filePath, 'demo\n');

    expect(parseLocalDirectoryPath(rootDir, { requireExists: true })).toBe(fs.realpathSync.native(rootDir));
    expect(() => parseLocalDirectoryPath('   ', { requireExists: false })).toThrow(
      'Root directory is required'
    );
    expect(() => parseLocalDirectoryPath('https://example.com', { requireExists: false })).toThrow(
      'Root directory must be a local filesystem path'
    );
    expect(() => parseLocalDirectoryPath(path.join(rootDir, 'missing'), { requireExists: true })).toThrow(
      'Root directory does not exist'
    );
    expect(() => parseLocalDirectoryPath(filePath, { requireExists: true })).toThrow(
      'Root path is not a directory'
    );
  });

  it('checks containment and sanitizes paths outside the workspace root', () => {
    const rootDir = mkdtemp('openweave-path-workspace-');
    const nestedDir = path.join(rootDir, 'src');
    fs.mkdirSync(nestedDir);
    const outsideDir = mkdtemp('openweave-path-outside-');

    expect(isPathWithinRoot(rootDir, nestedDir)).toBe(true);
    expect(isPathWithinRoot(rootDir, rootDir)).toBe(true);
    expect(isPathWithinRoot(rootDir, outsideDir)).toBe(false);
    expect(sanitizePathWithinRoot(rootDir, nestedDir)).toBe(fs.realpathSync.native(nestedDir));
    expect(sanitizePathWithinRoot(rootDir, outsideDir)).toBe(fs.realpathSync.native(rootDir));
    expect(sanitizePathWithinRoot(rootDir, 'https://example.com')).toBe(fs.realpathSync.native(rootDir));
  });
});
