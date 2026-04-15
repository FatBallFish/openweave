import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createFilesIpcHandlers,
  type FilesIpcHandlers
} from '../../../src/main/ipc/files';

let testDir = '';
let handlers: FilesIpcHandlers;

const runGit = (cwd: string, args: string[]): void => {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      LC_ALL: 'C'
    }
  });
};

const writeFile = (targetPath: string, content: string): void => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
};

const createFixtureRepo = (rootDir: string): void => {
  runGit(rootDir, ['init']);
  runGit(rootDir, ['config', 'user.name', 'OpenWeave Bot']);
  runGit(rootDir, ['config', 'user.email', 'openweave-bot@example.com']);

  writeFile(path.join(rootDir, 'src/app.ts'), 'export const app = 1;\n');
  writeFile(path.join(rootDir, 'node_modules/pkg/index.js'), 'module.exports = 1;\n');
  writeFile(path.join(rootDir, 'dist/main.js'), 'console.log("dist");\n');

  runGit(rootDir, ['add', 'src/app.ts']);
  runGit(rootDir, ['commit', '-m', 'init']);

  writeFile(path.join(rootDir, 'src/app.ts'), 'export const app = 2;\n');
};

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-file-tree-ipc-'));
  handlers = createFilesIpcHandlers();
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('file tree IPC flow', () => {
  it('ignores large generated directories and reports git status for changed files', async () => {
    const fixtureRepo = path.join(testDir, 'repo');
    fs.mkdirSync(fixtureRepo, { recursive: true });
    createFixtureRepo(fixtureRepo);

    const tree = await handlers.loadFileTree({} as IpcMainInvokeEvent, {
      rootDir: fixtureRepo
    });

    expect(tree.entries.some((entry) => entry.path.includes('node_modules'))).toBe(false);
    expect(tree.entries.some((entry) => entry.path.includes('dist'))).toBe(false);
    expect(tree.entries.find((entry) => entry.path === 'src/app.ts')?.gitStatus).toBe('M');
  });

  it('loads non-git directories without enabling write operations', async () => {
    const rootDir = path.join(testDir, 'plain');
    writeFile(path.join(rootDir, 'src/plain.txt'), 'plain file\n');
    writeFile(path.join(rootDir, 'node_modules/ignored.js'), 'ignored\n');

    const tree = await handlers.loadFileTree({} as IpcMainInvokeEvent, { rootDir });

    expect(tree.isGitRepo).toBe(false);
    expect(tree.readOnly).toBe(true);
    expect(tree.entries.find((entry) => entry.path === 'src/plain.txt')?.gitStatus).toBeNull();
    expect(tree.entries.some((entry) => entry.path.includes('node_modules'))).toBe(false);
  });
});
