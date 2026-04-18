import { describe, expect, it } from 'vitest';
import {
  componentUninstallSchema,
  componentTypeSchema,
  graphSnapshotSchemaV2,
  graphSaveSchemaV2
} from '../../../src/shared/ipc/schemas';

const createValidSnapshot = () => ({
  schemaVersion: 2 as const,
  nodes: [
    {
      id: 'node-note-1',
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: '需求拆解',
      bounds: {
        x: 100,
        y: 80,
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
      createdAtMs: 1,
      updatedAtMs: 2
    },
    {
      id: 'node-terminal-1',
      componentType: 'builtin.terminal',
      componentVersion: '1.0.0',
      title: 'Codex',
      bounds: {
        x: 520,
        y: 80,
        width: 420,
        height: 280
      },
      config: {
        runtime: 'codex'
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
      sourceHandle: null,
      targetHandle: 'input',
      label: 'feeds context',
      meta: {
        kind: 'context'
      },
      createdAtMs: 5,
      updatedAtMs: 6
    }
  ]
});

describe('graph schema v2', () => {
  it('parses a valid graph snapshot and save payload', () => {
    const snapshot = graphSnapshotSchemaV2.parse(createValidSnapshot());
    const savePayload = graphSaveSchemaV2.parse({
      workspaceId: 'ws-1',
      graphSnapshot: createValidSnapshot()
    });

    expect(snapshot.nodes[0]?.componentType).toBe('builtin.note');
    expect(snapshot.edges[0]?.targetHandle).toBe('input');
    expect(savePayload.graphSnapshot.schemaVersion).toBe(2);
  });

  it('accepts lowercase dot-separated component types and rejects invalid ones', () => {
    expect(componentTypeSchema.parse('builtin.file-tree')).toBe('builtin.file-tree');
    expect(() => componentTypeSchema.parse('Builtin.Note')).toThrow();
    expect(() => componentTypeSchema.parse('note')).toThrow();
  });

  it('rejects invalid node geometry and invalid graph edges', () => {
    expect(() =>
      graphSnapshotSchemaV2.parse({
        ...createValidSnapshot(),
        nodes: [
          {
            ...createValidSnapshot().nodes[0],
            bounds: {
              x: 100,
              y: 80,
              width: 0,
              height: 240
            }
          }
        ],
        edges: []
      })
    ).toThrow('Node width must be greater than 0');

    expect(() =>
      graphSnapshotSchemaV2.parse({
        ...createValidSnapshot(),
        edges: [
          {
            id: 'edge-self',
            source: 'node-note-1',
            target: 'node-note-1',
            sourceHandle: null,
            targetHandle: null,
            label: null,
            meta: {},
            createdAtMs: 5,
            updatedAtMs: 6
          }
        ]
      })
    ).toThrow('Graph self-loops are not supported');

    expect(() =>
      graphSnapshotSchemaV2.parse({
        ...createValidSnapshot(),
        edges: [
          {
            ...createValidSnapshot().edges[0],
            target: 'node-missing'
          }
        ]
      })
    ).toThrow('Graph edges must reference existing nodes');
  });

  it('rejects duplicate node ids and duplicate edge ids', () => {
    expect(() =>
      graphSnapshotSchemaV2.parse({
        ...createValidSnapshot(),
        nodes: [
          createValidSnapshot().nodes[0],
          {
            ...createValidSnapshot().nodes[1],
            id: 'node-note-1'
          }
        ],
        edges: []
      })
    ).toThrow('Graph node ids must be unique');

    expect(() =>
      graphSnapshotSchemaV2.parse({
        ...createValidSnapshot(),
        edges: [
          createValidSnapshot().edges[0],
          {
            ...createValidSnapshot().edges[0],
            source: 'node-terminal-1',
            target: 'node-note-1'
          }
        ]
      })
    ).toThrow('Graph edge ids must be unique');
  });

  it('rejects malformed component versions in graph nodes and component uninstall input', () => {
    expect(() =>
      graphSnapshotSchemaV2.parse({
        ...createValidSnapshot(),
        nodes: [
          {
            ...createValidSnapshot().nodes[0],
            componentVersion: 'latest'
          }
        ],
        edges: []
      })
    ).toThrow('Component version must use semver');

    expect(() =>
      componentUninstallSchema.parse({
        name: 'builtin.note',
        version: 'version-one'
      })
    ).toThrow('Component version must use semver');
  });
});
