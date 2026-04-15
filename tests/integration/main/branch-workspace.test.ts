import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';
import { createWorkspaceRepository } from '../../../src/main/db/workspace';
import {
  createBranchWorkspaceIpcHandlers,
  type BranchWorkspaceIpcHandlers
} from '../../../src/main/ipc/branch-workspaces';
import { createPortalSessionService } from '../../../src/main/portal/portal-session-service';

let testDir = '';
let workspaceDbDir = '';
let registry: RegistryRepository;
let handlers: BranchWorkspaceIpcHandlers;
let sourceWorkspaceId = '';
let sourceWorkspaceRootDir = '';

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

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
  runGit(rootDir, ['config', 'user.name', 'OpenWeave Test']);
  runGit(rootDir, ['config', 'user.email', 'openweave-test@example.com']);
  writeFile(path.join(rootDir, 'README.md'), '# OpenWeave fixture\n');
  writeFile(path.join(rootDir, 'src/main.ts'), 'export const value = 1;\n');
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '-m', 'init']);
};

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-branch-workspace-'));
  workspaceDbDir = path.join(testDir, 'workspaces');
  fs.mkdirSync(workspaceDbDir, { recursive: true });
  registry = createRegistryRepository({
    dbFilePath: path.join(testDir, 'registry.sqlite')
  });

  sourceWorkspaceRootDir = path.join(testDir, 'repo-source');
  fs.mkdirSync(sourceWorkspaceRootDir, { recursive: true });
  createFixtureRepo(sourceWorkspaceRootDir);
  const sourceWorkspace = registry.createWorkspace({
    name: 'Main Workspace',
    rootDir: sourceWorkspaceRootDir
  });
  sourceWorkspaceId = sourceWorkspace.id;

  const sourceRepository = createWorkspaceRepository({
    dbFilePath: path.join(workspaceDbDir, `${toWorkspaceDbFileName(sourceWorkspaceId)}.db`)
  });
  sourceRepository.saveCanvasState({
    nodes: [
      {
        id: 'portal-1',
        type: 'portal',
        x: 120,
        y: 80,
        url: 'http://127.0.0.1:3010/demo'
      },
      {
        id: 'terminal-1',
        type: 'terminal',
        x: 200,
        y: 80,
        command: 'echo source'
      },
      {
        id: 'file-tree-1',
        type: 'file-tree',
        x: 300,
        y: 80,
        rootDir: sourceWorkspaceRootDir
      }
    ],
    edges: []
  });
  sourceRepository.saveRun({
    id: 'run-source-1',
    workspaceId: sourceWorkspaceId,
    nodeId: 'terminal-1',
    runtime: 'shell',
    command: 'echo source',
    status: 'completed',
    summary: 'source complete',
    tailLog: 'source complete\n',
    createdAtMs: Date.now(),
    startedAtMs: Date.now(),
    completedAtMs: Date.now()
  });
  sourceRepository.close();

  const portalSessions = createPortalSessionService();
  portalSessions.upsertSession({
    workspaceId: sourceWorkspaceId,
    nodeId: 'portal-1',
    url: 'http://127.0.0.1:3010/demo'
  });

  handlers = createBranchWorkspaceIpcHandlers({
    registry,
    workspaceDbDir,
    portalSessionService: portalSessions
  });
});

afterEach(() => {
  registry.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('branch workspace flow', () => {
  it('creates a branch workspace with copied layout but isolated runtime and portal state', async () => {
    const created = await handlers.createBranchWorkspace({} as IpcMainInvokeEvent, {
      sourceWorkspaceId,
      branchName: 'feature/demo',
      copyCanvas: true
    });

    expect(created.workspace.id).not.toBe(sourceWorkspaceId);
    expect(created.workspace.rootDir).toContain(path.join('feature', 'demo'));
    expect(fs.existsSync(path.join(created.workspace.rootDir, '.git'))).toBe(true);

    const targetRepository = createWorkspaceRepository({
      dbFilePath: path.join(workspaceDbDir, `${toWorkspaceDbFileName(created.workspace.id)}.db`)
    });
    const targetCanvas = targetRepository.loadCanvasState();
    const portalNode = targetCanvas.nodes.find((node) => node.type === 'portal');
    const fileTreeNode = targetCanvas.nodes.find((node) => node.type === 'file-tree');
    expect(portalNode?.type === 'portal' ? portalNode.url : null).toBe('http://127.0.0.1:3010/demo');
    expect(fileTreeNode?.type === 'file-tree' ? fileTreeNode.rootDir : '').toBe(created.workspace.rootDir);
    expect(targetRepository.listRuns()).toHaveLength(0);
    targetRepository.close();

    expect(handlers.listWorkspacePortalSessions(created.workspace.id)).toHaveLength(0);
  });
});
