import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorkspaceRepository, type WorkspaceRepository } from '../../../src/main/db/workspace';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

let tempDir = '';
let repository: WorkspaceRepository | null = null;

const createSnapshot = (): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [
    {
      id: 'node-note-1',
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: 'Requirements',
      bounds: {
        x: 100,
        y: 120,
        width: 360,
        height: 240
      },
      config: {
        mode: 'markdown'
      },
      state: {
        content: '# hello'
      },
      capabilities: ['read', 'write'],
      createdAtMs: 10,
      updatedAtMs: 11
    },
    {
      id: 'node-terminal-1',
      componentType: 'builtin.terminal',
      componentVersion: '1.0.0',
      title: 'Shell',
      bounds: {
        x: 540,
        y: 120,
        width: 420,
        height: 260
      },
      config: {
        runtime: 'shell'
      },
      state: {
        activeSessionId: null
      },
      capabilities: ['read', 'write', 'execute', 'stream'],
      createdAtMs: 12,
      updatedAtMs: 13
    }
  ],
  edges: [
    {
      id: 'edge-note-terminal',
      source: 'node-note-1',
      target: 'node-terminal-1',
      sourceHandle: 'out',
      targetHandle: 'in',
      label: 'context',
      meta: {
        kind: 'context'
      },
      createdAtMs: 14,
      updatedAtMs: 15
    }
  ]
});

const createRepository = (): WorkspaceRepository => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-graph-v2-'));
  return createWorkspaceRepository({
    dbFilePath: path.join(tempDir, 'workspace.db')
  });
};

afterEach(() => {
  repository?.close();
  repository = null;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  }
});

describe('workspace repository graph v2 persistence', () => {
  it('saves and loads graph snapshots with v2 fields', () => {
    repository = createRepository();
    const input = createSnapshot();

    const saved = repository.saveGraphSnapshot(input);
    const loaded = repository.loadGraphSnapshot();

    expect(saved).toEqual(input);
    expect(loaded).toEqual(input);
  });

  it('keeps existing canvas/runs/audit behavior while graph v2 data exists', () => {
    repository = createRepository();
    repository.saveCanvasState({
      nodes: [
        {
          id: 'legacy-note-1',
          type: 'note',
          x: 20,
          y: 30,
          contentMd: 'legacy'
        }
      ],
      edges: []
    });
    repository.saveRun({
      id: 'run-1',
      workspaceId: 'ws-1',
      nodeId: 'legacy-note-1',
      runtime: 'shell',
      command: 'echo hi',
      status: 'completed',
      summary: 'ok',
      tailLog: 'ok\n',
      createdAtMs: 100,
      startedAtMs: 101,
      completedAtMs: 102
    });
    repository.appendAuditLog({
      id: 'audit-1',
      workspaceId: 'ws-1',
      eventType: 'run.completed',
      runId: 'run-1',
      status: 'success',
      message: 'done'
    });

    repository.saveGraphSnapshot(createSnapshot());

    expect(repository.loadCanvasState()).toEqual({
      nodes: [
        {
          id: 'legacy-note-1',
          type: 'note',
          x: 20,
          y: 30,
          contentMd: 'legacy'
        }
      ],
      edges: []
    });
    expect(repository.listRuns()).toHaveLength(1);
    expect(repository.listAuditLogs()).toHaveLength(1);
    expect(repository.loadGraphSnapshot().schemaVersion).toBe(2);
    expect(repository.loadGraphSnapshot().nodes).toHaveLength(2);
  });
});
