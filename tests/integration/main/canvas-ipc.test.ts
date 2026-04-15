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
});
