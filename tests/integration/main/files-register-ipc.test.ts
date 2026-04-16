import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createRegistryRepository } from '../../../src/main/db/registry';
import {
  disposeFilesIpcHandlers,
  registerFilesIpcHandlers
} from '../../../src/main/ipc/files';

class IpcMainStub {
  public readonly handlers = new Map<string, (...args: any[]) => unknown>();
  public readonly removed: string[] = [];

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }

  public async invoke(channel: string, payload: unknown): Promise<any> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`IPC handler not registered: ${channel}`);
    }
    return handler({}, payload);
  }
}

const createdPaths: string[] = [];

const mkdtemp = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdPaths.push(dir);
  return dir;
};

const runGit = (cwd: string, args: string[]): string => {
  return execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      LC_ALL: 'C'
    },
    encoding: 'utf8'
  });
};

const writeFile = (targetPath: string, content: string): void => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
};

afterEach(() => {
  disposeFilesIpcHandlers();
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('registered files IPC handlers', () => {
  it('loads file trees through the worker process and switches registries', async () => {
    const ipcMain = new IpcMainStub();
    const firstDir = mkdtemp('openweave-files-registered-a-');
    const firstRegistryPath = path.join(firstDir, 'registry.sqlite');
    const registry = createRegistryRepository({ dbFilePath: firstRegistryPath });
    const workspaceRoot = path.join(firstDir, 'workspace-root');
    const repoRoot = path.join(workspaceRoot, 'repo');
    fs.mkdirSync(repoRoot, { recursive: true });
    const workspace = registry.createWorkspace({
      name: 'Workspace A',
      rootDir: workspaceRoot
    });
    registry.close();

    runGit(repoRoot, ['init']);
    runGit(repoRoot, ['config', 'user.name', 'OpenWeave Test']);
    runGit(repoRoot, ['config', 'user.email', 'openweave-test@example.com']);
    writeFile(path.join(repoRoot, '.gitignore'), 'ignored.txt\n');
    writeFile(path.join(repoRoot, 'src/app.ts'), 'export const value = 1;\n');
    runGit(repoRoot, ['add', '.']);
    runGit(repoRoot, ['commit', '-m', 'init']);
    writeFile(path.join(repoRoot, 'src/app.ts'), 'export const value = 2;\n');
    writeFile(path.join(repoRoot, 'ignored.txt'), 'ignored\n');

    registerFilesIpcHandlers({
      dbFilePath: firstRegistryPath,
      ipcMain
    });

    expect(ipcMain.removed).toEqual([IPC_CHANNELS.fileTreeLoad]);

    const tree = await ipcMain.invoke(IPC_CHANNELS.fileTreeLoad, {
      workspaceId: workspace.id,
      rootDir: repoRoot
    });
    expect(tree.isGitRepo).toBe(true);
    expect(tree.entries.find((entry: { path: string }) => entry.path === 'src/app.ts')).toBeTruthy();
    expect(tree.gitSummary.modified).toBeGreaterThanOrEqual(1);

    const secondDir = mkdtemp('openweave-files-registered-b-');
    const secondRegistryPath = path.join(secondDir, 'registry.sqlite');
    const secondRegistry = createRegistryRepository({ dbFilePath: secondRegistryPath });
    const secondRoot = path.join(secondDir, 'workspace-root');
    const secondRepoRoot = path.join(secondRoot, 'plain');
    fs.mkdirSync(secondRepoRoot, { recursive: true });
    writeFile(path.join(secondRepoRoot, 'notes.txt'), 'hello\n');
    const secondWorkspace = secondRegistry.createWorkspace({
      name: 'Workspace B',
      rootDir: secondRoot
    });
    secondRegistry.close();

    registerFilesIpcHandlers({
      dbFilePath: secondRegistryPath,
      ipcMain
    });

    const plainTree = await ipcMain.invoke(IPC_CHANNELS.fileTreeLoad, {
      workspaceId: secondWorkspace.id,
      rootDir: secondRepoRoot
    });
    expect(plainTree.isGitRepo).toBe(false);
    expect(plainTree.readOnly).toBe(true);
    expect(plainTree.entries.find((entry: { path: string }) => entry.path === 'notes.txt')).toBeTruthy();
  });
});
