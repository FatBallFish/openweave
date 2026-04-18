import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';
import { createWorkspaceRepository } from '../../../src/main/db/workspace';
import {
  createLocalWorkspaceNodeQueryService,
  type LocalWorkspaceNodeQueryService
} from '../../../src/main/bridge/workspace-node-query-service';
import type { ComponentActionDispatcher } from '../../../src/main/components/component-action-dispatcher';

let tempDir = '';
let workspaceDbDir = '';
let registryDbFilePath = '';
let registry: RegistryRepository | null = null;
let service: LocalWorkspaceNodeQueryService | null = null;
let workspaceId = '';
let workspaceRootDir = '';

const toWorkspaceDbPath = (id: string): string => {
  return path.join(workspaceDbDir, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`);
};

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-query-service-'));
  workspaceDbDir = path.join(tempDir, 'workspaces');
  registryDbFilePath = path.join(tempDir, 'registry.sqlite');
  fs.mkdirSync(workspaceDbDir, { recursive: true });
  workspaceRootDir = path.join(tempDir, 'repo');
  fs.mkdirSync(workspaceRootDir, { recursive: true });
  workspaceRootDir = fs.realpathSync(workspaceRootDir);

  registry = createRegistryRepository({ dbFilePath: registryDbFilePath });
  workspaceId = registry.createWorkspace({
    name: 'Demo Workspace',
    rootDir: workspaceRootDir
  }).id;

  const workspaceRepository = createWorkspaceRepository({
    dbFilePath: toWorkspaceDbPath(workspaceId)
  });
  workspaceRepository.saveGraphSnapshot({
    schemaVersion: 2,
    nodes: [
      {
        id: 'node-note-1',
        componentType: 'builtin.note',
        componentVersion: '1.0.0',
        title: 'Requirements',
        bounds: {
          x: 10,
          y: 20,
          width: 320,
          height: 240
        },
        config: {
          mode: 'markdown'
        },
        state: {
          content: '# hi'
        },
        capabilities: ['read', 'write'],
        createdAtMs: 1,
        updatedAtMs: 2
      },
      {
        id: 'node-terminal-1',
        componentType: 'builtin.terminal',
        componentVersion: '1.0.0',
        title: 'Terminal',
        bounds: {
          x: 400,
          y: 20,
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
        createdAtMs: 3,
        updatedAtMs: 4
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-note-1',
        target: 'node-terminal-1',
        sourceHandle: 'context',
        targetHandle: 'input',
        label: 'feeds',
        meta: {
          kind: 'context'
        },
        createdAtMs: 5,
        updatedAtMs: 6
      }
    ]
  });
  workspaceRepository.close();

  service = createLocalWorkspaceNodeQueryService({
    registryDbFilePath,
    workspaceDbDir
  });
});

afterEach(() => {
  service?.close();
  service = null;
  registry?.close();
  registry = null;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  }
});

describe('local workspace/node query service', () => {
  it('resolves workspace by explicit id or cwd match', () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });

    expect(service?.resolveWorkspaceId({ workspaceId, cwd: nestedCwd })).toBe(workspaceId);
    expect(service?.resolveWorkspaceId({ cwd: nestedCwd })).toBe(workspaceId);
  });

  it('returns stable workspace and node query data', () => {
    const info = service?.getWorkspaceInfo({ workspaceId });
    const listed = service?.listNodes({ workspaceId });
    const node = service?.getNode({ workspaceId, nodeId: 'node-note-1' });
    const neighbors = service?.getNodeNeighbors({ workspaceId, nodeId: 'node-terminal-1' });

    expect(info).toEqual({
      workspaceId,
      name: 'Demo Workspace',
      rootDir: workspaceRootDir,
      graphSchemaVersion: 2,
      nodeCount: 2,
      edgeCount: 1
    });
    expect(listed).toEqual({
      nodes: [
        {
          id: 'node-note-1',
          title: 'Requirements',
          componentType: 'builtin.note',
          componentVersion: '1.0.0',
          capabilities: ['read', 'write']
        },
        {
          id: 'node-terminal-1',
          title: 'Terminal',
          componentType: 'builtin.terminal',
          componentVersion: '1.0.0',
          capabilities: ['read', 'write', 'execute', 'stream']
        }
      ]
    });
    expect(node).toEqual({
      node: {
        id: 'node-note-1',
        componentType: 'builtin.note',
        componentVersion: '1.0.0',
        title: 'Requirements',
        bounds: {
          x: 10,
          y: 20,
          width: 320,
          height: 240
        },
        config: {
          mode: 'markdown'
        },
        state: {
          content: '# hi'
        },
        capabilities: ['read', 'write']
      }
    });
    expect(neighbors).toEqual({
      nodeId: 'node-terminal-1',
      upstream: [
        {
          edgeId: 'edge-1',
          nodeId: 'node-note-1',
          componentType: 'builtin.note',
          title: 'Requirements'
        }
      ],
      downstream: []
    });
  });

  it('returns coded errors for unmatched cwd and missing nodes', () => {
    const missingWorkspaceDir = path.join(tempDir, 'outside');
    fs.mkdirSync(missingWorkspaceDir, { recursive: true });

    expect(() => service?.resolveWorkspaceId({ cwd: missingWorkspaceDir })).toThrow(
      'WORKSPACE_NOT_FOUND_FOR_CWD'
    );
    expect(() => service?.getNode({ workspaceId, nodeId: 'missing-node' })).toThrow('NODE_NOT_FOUND');
    expect(() => service?.getNodeNeighbors({ workspaceId, nodeId: 'missing-node' })).toThrow(
      'NODE_NOT_FOUND'
    );
  });

  it('supports builtin.note read/write and persists updated content', () => {
    const readableService = service as unknown as {
      readNode: (input: { workspaceId: string; nodeId: string; mode?: string }) => {
        nodeId: string;
        action: 'read';
        result: { content: string };
      };
      runNodeAction: (input: {
        workspaceId: string;
        nodeId: string;
        action: string;
        payload?: Record<string, unknown>;
      }) => {
        nodeId: string;
        action: string;
        ok: true;
        result: { updated: boolean };
      };
    };

    expect(readableService.readNode({ workspaceId, nodeId: 'node-note-1', mode: 'content' })).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: '# hi'
      }
    });

    expect(
      readableService.runNodeAction({
        workspaceId,
        nodeId: 'node-note-1',
        action: 'write',
        payload: {
          content: 'new'
        }
      })
    ).toEqual({
      nodeId: 'node-note-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });

    expect(readableService.readNode({ workspaceId, nodeId: 'node-note-1' })).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: 'new'
      }
    });

    const reloadedService = createLocalWorkspaceNodeQueryService({
      registryDbFilePath,
      workspaceDbDir
    }) as unknown as {
      readNode: (input: { workspaceId: string; nodeId: string; mode?: string }) => {
        nodeId: string;
        action: 'read';
        result: { content: string };
      };
      close: () => void;
    };
    try {
      expect(reloadedService.readNode({ workspaceId, nodeId: 'node-note-1', mode: 'content' })).toEqual({
        nodeId: 'node-note-1',
        action: 'read',
        result: {
          content: 'new'
        }
      });
    } finally {
      reloadedService.close();
    }
  });

  it('supports builtin.text and builtin.attachment reads and rejects actions', () => {
    const workspaceRepository = createWorkspaceRepository({
      dbFilePath: toWorkspaceDbPath(workspaceId)
    });
    workspaceRepository.saveGraphSnapshot({
      schemaVersion: 2,
      nodes: [
        {
          id: 'node-text-1',
          componentType: 'builtin.text',
          componentVersion: '1.0.0',
          title: 'Text',
          bounds: {
            x: 10,
            y: 20,
            width: 320,
            height: 240
          },
          config: {
            mode: 'plain'
          },
          state: {
            content: 'hello text'
          },
          capabilities: ['read'],
          createdAtMs: 1,
          updatedAtMs: 2
        },
        {
          id: 'node-attachment-1',
          componentType: 'builtin.attachment',
          componentVersion: '1.0.0',
          title: 'Attachment',
          bounds: {
            x: 400,
            y: 20,
            width: 420,
            height: 260
          },
          config: {},
          state: {
            attachments: [
              {
                id: 'att-1',
                name: 'design.pdf',
                path: '/tmp/design.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 1234
              },
              {
                id: 'att-2',
                name: 'notes.txt',
                path: '/tmp/notes.txt'
              }
            ]
          },
          capabilities: ['read'],
          createdAtMs: 3,
          updatedAtMs: 4
        }
      ],
      edges: []
    });
    workspaceRepository.close();

    const actionableService = service as unknown as {
      readNode: (input: { workspaceId: string; nodeId: string; mode?: string }) => unknown;
      runNodeAction: (input: { workspaceId: string; nodeId: string; action: string }) => unknown;
    };

    expect(actionableService.readNode({ workspaceId, nodeId: 'node-text-1' })).toEqual({
      nodeId: 'node-text-1',
      action: 'read',
      result: {
        content: 'hello text'
      }
    });
    expect(actionableService.readNode({ workspaceId, nodeId: 'node-text-1', mode: 'content' })).toEqual({
      nodeId: 'node-text-1',
      action: 'read',
      result: {
        content: 'hello text'
      }
    });
    expect(actionableService.readNode({ workspaceId, nodeId: 'node-attachment-1' })).toEqual({
      nodeId: 'node-attachment-1',
      action: 'read',
      result: {
        content: '2 attachments: design.pdf, notes.txt',
        count: 2,
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            name: 'notes.txt',
            path: '/tmp/notes.txt',
            mimeType: null,
            sizeBytes: null
          }
        ]
      }
    });
    expect(
      actionableService.readNode({
        workspaceId,
        nodeId: 'node-attachment-1',
        mode: 'content'
      })
    ).toEqual({
      nodeId: 'node-attachment-1',
      action: 'read',
      result: {
        content: '2 attachments: design.pdf, notes.txt',
        count: 2,
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            name: 'notes.txt',
            path: '/tmp/notes.txt',
            mimeType: null,
            sizeBytes: null
          }
        ]
      }
    });

    expect(() => actionableService.readNode({ workspaceId, nodeId: 'node-text-1', mode: 'summary' })).toThrow(
      'NODE_ACTION_NOT_SUPPORTED'
    );
    expect(
      () => actionableService.readNode({ workspaceId, nodeId: 'node-attachment-1', mode: 'summary' })
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');
    expect(
      () =>
        actionableService.runNodeAction({
          workspaceId,
          nodeId: 'node-text-1',
          action: 'write'
        })
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');
    expect(
      () =>
        actionableService.runNodeAction({
          workspaceId,
          nodeId: 'node-attachment-1',
          action: 'write'
        })
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');
  });

  it('returns NODE_ACTION_NOT_SUPPORTED for unsupported type or capability', () => {
    const workspaceRepository = createWorkspaceRepository({
      dbFilePath: toWorkspaceDbPath(workspaceId)
    });
    workspaceRepository.saveGraphSnapshot({
      schemaVersion: 2,
      nodes: [
        {
          id: 'node-note-1',
          componentType: 'builtin.note',
          componentVersion: '1.0.0',
          title: 'Requirements',
          bounds: {
            x: 10,
            y: 20,
            width: 320,
            height: 240
          },
          config: {
            mode: 'markdown'
          },
          state: {
            content: '# hi'
          },
          capabilities: ['read', 'write'],
          createdAtMs: 1,
          updatedAtMs: 2
        },
        {
          id: 'node-note-readonly',
          componentType: 'builtin.note',
          componentVersion: '1.0.0',
          title: 'Readonly note',
          bounds: {
            x: 40,
            y: 60,
            width: 320,
            height: 240
          },
          config: {
            mode: 'markdown'
          },
          state: {
            content: 'readonly'
          },
          capabilities: ['read'],
          createdAtMs: 7,
          updatedAtMs: 8
        },
        {
          id: 'node-terminal-1',
          componentType: 'builtin.terminal',
          componentVersion: '1.0.0',
          title: 'Terminal',
          bounds: {
            x: 400,
            y: 20,
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
          createdAtMs: 3,
          updatedAtMs: 4
        }
      ],
      edges: []
    });
    workspaceRepository.close();

    const actionableService = service as unknown as {
      readNode: (input: { workspaceId: string; nodeId: string; mode?: string }) => unknown;
      runNodeAction: (input: { workspaceId: string; nodeId: string; action: string }) => unknown;
    };

    expect(() => actionableService.readNode({ workspaceId, nodeId: 'node-terminal-1' })).toThrow(
      'NODE_ACTION_NOT_SUPPORTED'
    );
    expect(() => actionableService.readNode({ workspaceId, nodeId: 'node-note-1', mode: 'summary' })).toThrow(
      'NODE_ACTION_NOT_SUPPORTED'
    );
    expect(
      () =>
        actionableService.runNodeAction({
          workspaceId,
          nodeId: 'node-note-readonly',
          action: 'write'
        })
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');
  });

  it('delegates node read/action through injected component action dispatcher', () => {
    service?.close();

    const readCalls: Array<{ workspaceId: string; nodeId: string; mode?: string }> = [];
    const actionCalls: Array<{ workspaceId: string; nodeId: string; action: string }> = [];
    const dispatcher: ComponentActionDispatcher = {
      read: (context, input) => {
        readCalls.push({
          workspaceId: context.workspaceId,
          nodeId: context.node.id,
          mode: input.mode
        });
        return {
          nodeId: context.node.id,
          action: 'read',
          result: {
            content: 'from-dispatcher'
          }
        };
      },
      action: (context, input) => {
        actionCalls.push({
          workspaceId: context.workspaceId,
          nodeId: context.node.id,
          action: input.action
        });
        return {
          nodeId: context.node.id,
          action: input.action,
          ok: true,
          result: {
            updated: true
          }
        };
      }
    };

    service = createLocalWorkspaceNodeQueryService({
      registryDbFilePath,
      workspaceDbDir,
      componentActionDispatcher: dispatcher
    });

    expect(service.readNode({ workspaceId, nodeId: 'node-note-1', mode: 'content' })).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: 'from-dispatcher'
      }
    });
    expect(
      service.runNodeAction({
        workspaceId,
        nodeId: 'node-note-1',
        action: 'write',
        payload: {
          content: 'ignored'
        }
      })
    ).toEqual({
      nodeId: 'node-note-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });
    expect(readCalls).toEqual([
      {
        workspaceId,
        nodeId: 'node-note-1',
        mode: 'content'
      }
    ]);
    expect(actionCalls).toEqual([
      {
        workspaceId,
        nodeId: 'node-note-1',
        action: 'write'
      }
    ]);
  });
});
