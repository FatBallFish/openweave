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
import { createWorkspaceIpcHandlers, type WorkspaceIpcHandlers } from '../../../src/main/ipc/workspaces';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

let testDir = '';
let workspaceDbDir = '';
let registry: RegistryRepository;
let branchHandlers: BranchWorkspaceIpcHandlers;
let workspaceHandlers: WorkspaceIpcHandlers;
let sourceWorkspaceId = '';
let sourceWorkspaceRootDir = '';

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const toWorkspaceDbPath = (workspaceId: string): string => {
  return path.join(workspaceDbDir, `${toWorkspaceDbFileName(workspaceId)}.db`);
};

const toBranchWorkspaceRootDir = (sourceRootDir: string, branchName: string): string => {
  const sourceBaseName = path.basename(sourceRootDir);
  const branchPathSegments = branchName
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return path.join(path.dirname(sourceRootDir), '.openweave-worktrees', sourceBaseName, ...branchPathSegments);
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

const createFixtureRepo = (rootDir: string): void => {
  runGit(rootDir, ['init']);
  runGit(rootDir, ['config', 'user.name', 'OpenWeave Test']);
  runGit(rootDir, ['config', 'user.email', 'openweave-test@example.com']);
  writeFile(path.join(rootDir, 'README.md'), '# OpenWeave fixture\n');
  writeFile(path.join(rootDir, 'src/main.ts'), 'export const value = 1;\n');
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '-m', 'init']);
};

const createGraphSnapshot = (workspaceRootDir: string): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [
    {
      id: 'portal-1',
      componentType: 'builtin.portal',
      componentVersion: '1.0.0',
      title: 'Portal',
      bounds: {
        x: 120,
        y: 80,
        width: 420,
        height: 320
      },
      config: {
        url: 'http://127.0.0.1:3010/demo'
      },
      state: {},
      capabilities: ['navigate', 'capture', 'input'],
      createdAtMs: 1,
      updatedAtMs: 2
    },
    {
      id: 'terminal-1',
      componentType: 'builtin.terminal',
      componentVersion: '1.0.0',
      title: 'Terminal',
      bounds: {
        x: 200,
        y: 80,
        width: 420,
        height: 260
      },
      config: {
        command: 'echo source',
        runtime: 'shell'
      },
      state: {
        activeSessionId: null
      },
      capabilities: ['read', 'write', 'execute', 'stream'],
      createdAtMs: 3,
      updatedAtMs: 4
    },
    {
      id: 'file-tree-1',
      componentType: 'builtin.file-tree',
      componentVersion: '1.0.0',
      title: 'File tree',
      bounds: {
        x: 300,
        y: 80,
        width: 360,
        height: 280
      },
      config: {
        rootDir: path.join(workspaceRootDir, 'src')
      },
      state: {},
      capabilities: ['read', 'listChildren'],
      createdAtMs: 5,
      updatedAtMs: 6
    }
  ],
  edges: []
});

const branchExists = (repoRootDir: string, branchName: string): boolean => {
  try {
    runGit(repoRootDir, ['show-ref', '--verify', `refs/heads/${branchName}`]);
    return true;
  } catch {
    return false;
  }
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
  sourceWorkspaceRootDir = fs.realpathSync(sourceWorkspaceRootDir);
  const sourceWorkspace = registry.createWorkspace({
    name: 'Main Workspace',
    rootDir: sourceWorkspaceRootDir
  });
  sourceWorkspaceId = sourceWorkspace.id;

  const sourceRepository = createWorkspaceRepository({
    dbFilePath: toWorkspaceDbPath(sourceWorkspaceId)
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
        rootDir: path.join(sourceWorkspaceRootDir, 'src')
      }
    ],
    edges: []
  });
  sourceRepository.saveGraphSnapshot(createGraphSnapshot(sourceWorkspaceRootDir));
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

  branchHandlers = createBranchWorkspaceIpcHandlers({
    registry,
    workspaceDbDir,
    portalSessionService: portalSessions
  });
  workspaceHandlers = createWorkspaceIpcHandlers({
    registry,
    onWorkspaceDeleting: async (workspace) => {
      await branchHandlers.cleanupBranchWorkspaceOnDelete(workspace.id);
    }
  });
});

afterEach(() => {
  registry.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('branch workspace flow', () => {
  it('creates a branch workspace with copied canvas layout but isolated run and portal session state', async () => {
    const branchName = `feature/demo-${Date.now().toString()}`;
    const created = await branchHandlers.createBranchWorkspace({} as IpcMainInvokeEvent, {
      sourceWorkspaceId,
      branchName,
      copyCanvas: true
    });

    expect(created.workspace.id).not.toBe(sourceWorkspaceId);
    expect(created.workspace.rootDir).toBe(toBranchWorkspaceRootDir(sourceWorkspaceRootDir, branchName));
    expect(fs.existsSync(path.join(created.workspace.rootDir, '.git'))).toBe(true);

    const link = registry.getBranchWorkspaceLink(created.workspace.id);
    expect(link?.workspaceId).toBe(created.workspace.id);
    expect(link?.sourceWorkspaceId).toBe(sourceWorkspaceId);
    expect(link?.branchName).toBe(branchName);
    expect(link?.targetRootDir).toBe(created.workspace.rootDir);

    const targetRepository = createWorkspaceRepository({
      dbFilePath: toWorkspaceDbPath(created.workspace.id)
    });
    const targetCanvas = targetRepository.loadCanvasState();
    const targetGraph = targetRepository.loadGraphSnapshot();
    const portalNode = targetCanvas.nodes.find((node) => node.type === 'portal');
    const fileTreeNode = targetCanvas.nodes.find((node) => node.type === 'file-tree');
    const graphPortalNode = targetGraph.nodes.find((node) => node.componentType === 'builtin.portal');
    const graphFileTreeNode = targetGraph.nodes.find(
      (node) => node.componentType === 'builtin.file-tree'
    );
    expect(portalNode?.type === 'portal' ? portalNode.url : null).toBe('http://127.0.0.1:3010/demo');
    expect(fileTreeNode?.type === 'file-tree' ? fileTreeNode.rootDir : '').toBe(
      path.join(created.workspace.rootDir, 'src')
    );
    expect(graphPortalNode?.componentType === 'builtin.portal' ? graphPortalNode.config.url : null).toBe(
      'http://127.0.0.1:3010/demo'
    );
    expect(
      graphFileTreeNode?.componentType === 'builtin.file-tree'
        ? graphFileTreeNode.config.rootDir
        : ''
    ).toBe(path.join(created.workspace.rootDir, 'src'));
    expect(targetRepository.listRuns()).toHaveLength(0);
    targetRepository.close();

    expect(branchHandlers.listWorkspacePortalSessions(created.workspace.id)).toHaveLength(0);
  });

  it('deletes branch workspace by cleaning up git worktree and branch', async () => {
    const branchName = `feature/delete-${Date.now().toString()}`;
    const created = await branchHandlers.createBranchWorkspace({} as IpcMainInvokeEvent, {
      sourceWorkspaceId,
      branchName,
      copyCanvas: false
    });

    expect(branchExists(sourceWorkspaceRootDir, branchName)).toBe(true);
    expect(fs.existsSync(created.workspace.rootDir)).toBe(true);
    expect(runGit(sourceWorkspaceRootDir, ['worktree', 'list', '--porcelain'])).toContain(
      created.workspace.rootDir
    );

    const removed = await workspaceHandlers.delete({} as IpcMainInvokeEvent, {
      workspaceId: created.workspace.id
    });
    expect(removed.deleted).toBe(true);
    expect(registry.hasWorkspace(created.workspace.id)).toBe(false);
    expect(registry.getBranchWorkspaceLink(created.workspace.id)).toBeNull();
    expect(branchExists(sourceWorkspaceRootDir, branchName)).toBe(false);
    expect(fs.existsSync(created.workspace.rootDir)).toBe(false);
    expect(runGit(sourceWorkspaceRootDir, ['worktree', 'list', '--porcelain'])).not.toContain(
      created.workspace.rootDir
    );
  });

  it('fails closed when branch-workspace link points to an unmanaged cleanup target', async () => {
    const branchName = `feature/safety-${Date.now().toString()}`;
    const created = await branchHandlers.createBranchWorkspace({} as IpcMainInvokeEvent, {
      sourceWorkspaceId,
      branchName,
      copyCanvas: false
    });

    const unsafeTargetDir = path.join(testDir, 'unsafe-cleanup-target');
    fs.mkdirSync(unsafeTargetDir, { recursive: true });
    const sentinelFile = path.join(unsafeTargetDir, 'sentinel.txt');
    writeFile(sentinelFile, 'must-not-delete\n');

    registry.upsertBranchWorkspaceLink({
      workspaceId: created.workspace.id,
      sourceWorkspaceId,
      branchName,
      sourceRootDir: sourceWorkspaceRootDir,
      targetRootDir: unsafeTargetDir
    });

    await expect(
      workspaceHandlers.delete({} as IpcMainInvokeEvent, {
        workspaceId: created.workspace.id
      })
    ).rejects.toThrow('Refusing cleanup for unmanaged target directory');

    expect(registry.hasWorkspace(created.workspace.id)).toBe(true);
    expect(registry.getBranchWorkspaceLink(created.workspace.id)?.targetRootDir).toBe(unsafeTargetDir);
    expect(fs.existsSync(unsafeTargetDir)).toBe(true);
    expect(fs.existsSync(sentinelFile)).toBe(true);
    expect(fs.existsSync(created.workspace.rootDir)).toBe(true);
    expect(branchExists(sourceWorkspaceRootDir, branchName)).toBe(true);
    expect(runGit(sourceWorkspaceRootDir, ['worktree', 'list', '--porcelain'])).toContain(
      created.workspace.rootDir
    );
  });

  it('rolls back workspace row and git artifacts when create fails after worktree setup', async () => {
    const branchName = `feature/rollback-${Date.now().toString()}`;
    const expectedTargetRootDir = toBranchWorkspaceRootDir(sourceWorkspaceRootDir, branchName);
    const failingHandlers = createBranchWorkspaceIpcHandlers({
      registry,
      workspaceDbDir,
      cloneCanvasLayout: () => {
        throw new Error('clone failed intentionally');
      }
    });

    await expect(
      failingHandlers.createBranchWorkspace({} as IpcMainInvokeEvent, {
        sourceWorkspaceId,
        branchName,
        copyCanvas: true
      })
    ).rejects.toThrow('clone failed intentionally');

    const remainingWorkspaces = registry.listWorkspaces();
    expect(remainingWorkspaces).toHaveLength(1);
    expect(remainingWorkspaces[0].id).toBe(sourceWorkspaceId);
    expect(branchExists(sourceWorkspaceRootDir, branchName)).toBe(false);
    expect(fs.existsSync(expectedTargetRootDir)).toBe(false);
    expect(runGit(sourceWorkspaceRootDir, ['worktree', 'list', '--porcelain'])).not.toContain(
      expectedTargetRootDir
    );
  });

  it('rejects option-like branch names', async () => {
    const branchName = '--dangerous';
    const expectedTargetRootDir = toBranchWorkspaceRootDir(sourceWorkspaceRootDir, branchName);

    await expect(
      branchHandlers.createBranchWorkspace({} as IpcMainInvokeEvent, {
        sourceWorkspaceId,
        branchName,
        copyCanvas: false
      })
    ).rejects.toThrow('Branch name cannot start with -');

    expect(registry.listWorkspaces()).toHaveLength(1);
    expect(branchExists(sourceWorkspaceRootDir, branchName)).toBe(false);
    expect(fs.existsSync(expectedTargetRootDir)).toBe(false);
  });
});
