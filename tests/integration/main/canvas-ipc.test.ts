import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCanvasIpcHandlers,
  type CanvasIpcHandlers
} from '../../../src/main/ipc/canvas';
import { createWorkspaceRepository, type WorkspaceRepository } from '../../../src/main/db/workspace';

let testDbDir = '';
let repositories = new Map<string, WorkspaceRepository>();
let handlers: CanvasIpcHandlers;

const getRepositoryForWorkspace = (workspaceId: string): WorkspaceRepository => {
  const existing = repositories.get(workspaceId);
  if (existing) {
    return existing;
  }

  const repository = createWorkspaceRepository({
    dbFilePath: path.join(testDbDir, `${workspaceId}.sqlite`)
  });
  repositories.set(workspaceId, repository);
  return repository;
};

beforeEach(() => {
  testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-canvas-ipc-'));
  repositories = new Map<string, WorkspaceRepository>();
  handlers = createCanvasIpcHandlers({
    assertWorkspaceExists: (workspaceId: string) => {
      if (workspaceId !== 'workspace-1') {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
    },
    resolveWorkspaceRootDir: (_workspaceId: string) => path.join(testDbDir, 'workspace-1-root'),
    getWorkspaceRepository: getRepositoryForWorkspace
  });
});

afterEach(() => {
  for (const repository of repositories.values()) {
    repository.close();
  }
  fs.rmSync(testDbDir, { recursive: true, force: true });
});

describe('canvas IPC flow', () => {
  it('persists node position and markdown content', async () => {
    const workspaceId = 'workspace-1';
    await handlers.save({} as IpcMainInvokeEvent, {
      workspaceId,
      state: {
        nodes: [{ id: 'note-1', type: 'note', x: 120, y: 80, contentMd: '# Hello' }],
        edges: []
      }
    });

    const restored = await handlers.load({} as IpcMainInvokeEvent, { workspaceId });
    expect(restored.state.nodes[0]).toMatchObject({ x: 120, y: 80, contentMd: '# Hello' });
  });

  it('rejects unknown workspace ids before reading or writing canvas state', async () => {
    await expect(
      handlers.load({} as IpcMainInvokeEvent, { workspaceId: 'workspace-missing' })
    ).rejects.toThrow('Workspace not found: workspace-missing');
    await expect(
      handlers.save({} as IpcMainInvokeEvent, {
        workspaceId: 'workspace-missing',
        state: { nodes: [], edges: [] }
      })
    ).rejects.toThrow('Workspace not found: workspace-missing');
    expect(repositories.has('workspace-missing')).toBe(false);
  });

  it('filters dangling edges that reference missing nodes', async () => {
    const workspaceId = 'workspace-1';
    await handlers.save({} as IpcMainInvokeEvent, {
      workspaceId,
      state: {
        nodes: [{ id: 'note-1', type: 'note', x: 0, y: 0, contentMd: 'note' }],
        edges: [{ id: 'edge-1', sourceNodeId: 'note-1', targetNodeId: 'note-404' }]
      }
    });

    const restored = await handlers.load({} as IpcMainInvokeEvent, { workspaceId });
    expect(restored.state.edges).toEqual([]);
  });

  it('sanitizes file-tree node roots that drift outside workspace root', async () => {
    const workspaceId = 'workspace-1';
    await handlers.save({} as IpcMainInvokeEvent, {
      workspaceId,
      state: {
        nodes: [
          {
            id: 'tree-1',
            type: 'file-tree',
            x: 0,
            y: 0,
            rootDir: '/tmp/outside-workspace-root'
          }
        ],
        edges: []
      }
    });

    const restored = await handlers.load({} as IpcMainInvokeEvent, { workspaceId });
    const node = restored.state.nodes.find((item) => item.id === 'tree-1');
    expect(node?.type).toBe('file-tree');
    if (node?.type === 'file-tree') {
      expect(node.rootDir).toContain('workspace-1-root');
    }
  });
});
