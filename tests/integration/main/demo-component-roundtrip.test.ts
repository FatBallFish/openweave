import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createComponentInstaller } from '../../../src/main/components/component-installer';
import {
  createComponentActionAdapterRegistry
} from '../../../src/main/components/component-action-adapter-registry';
import { createComponentRegistry } from '../../../src/main/components/component-registry';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const demoEchoFixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/components/demo-echo');
const requireForTest = createRequire(import.meta.url);

const loadModuleExportKeysWithNode = (modulePath: string): string[] => {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        "const mod=require(process.argv[1]);process.stdout.write(JSON.stringify(Object.keys(mod).sort()));",
        modulePath
      ],
      {
        encoding: 'utf8'
      }
    )
  ) as string[];
};

const createGraph = (): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [
    {
      id: 'node-demo-echo-1',
      componentType: 'external.demo-echo',
      componentVersion: '0.1.0',
      title: 'Demo Echo',
      bounds: {
        x: 10,
        y: 20,
        width: 320,
        height: 180
      },
      config: {
        mode: 'plain'
      },
      state: {
        content: 'hello demo'
      },
      capabilities: ['read', 'write'],
      createdAtMs: 1,
      updatedAtMs: 2
    }
  ],
  edges: []
});

let testDir = '';
let registryRepository: RegistryRepository;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-demo-component-roundtrip-'));
  registryRepository = createRegistryRepository({
    dbFilePath: path.join(testDir, 'registry.sqlite'),
    now: () => 1_700_000_000_000
  });
});

afterEach(() => {
  registryRepository.close();
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('demo component roundtrip', () => {
  it('installs demo echo, resolves its manifest from graph metadata, and closes read/write/echo through the installed worker surface', async () => {
    const componentRegistry = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });
    const installer = createComponentInstaller({
      componentRegistry,
      installRoot: path.join(testDir, 'installed-components')
    });
    const installed = await installer.installFromDirectory({
      packageRoot: demoEchoFixtureRoot
    });
    const graph = createGraph();
    const node = graph.nodes[0];
    const resolved = componentRegistry.resolveExactVersion(node.componentType, node.componentVersion, 'enabled');
    const workerModulePath = path.join(installed.packageRoot, 'worker', 'index.js');
    const workerModule = requireForTest(path.join(installed.packageRoot, 'worker', 'index.js')) as {
      createDemoEchoActionAdapter?: () => {
        supports: (componentType: string) => boolean;
        read: (context: {
          workspaceId: string;
          graph: GraphSnapshotV2Input;
          node: GraphSnapshotV2Input['nodes'][number];
          saveGraph: (nextGraph: GraphSnapshotV2Input) => void;
        }) => {
          nodeId: string;
          action: 'read';
          result: { content: string };
        };
        action: (
          context: {
            workspaceId: string;
            graph: GraphSnapshotV2Input;
            node: GraphSnapshotV2Input['nodes'][number];
            saveGraph: (nextGraph: GraphSnapshotV2Input) => void;
          },
          input: { action: string; payload?: Record<string, unknown> }
        ) => {
          nodeId: string;
          action: string;
          ok: true;
          result: Record<string, unknown>;
        };
      };
    };
    const adapterRegistry = createComponentActionAdapterRegistry();
    adapterRegistry.register({
      componentType: 'external.demo-echo',
      source: 'external',
      adapter: workerModule.createDemoEchoActionAdapter!()
    });
    const dispatcher = adapterRegistry.createDispatcher();
    let persistedGraph: GraphSnapshotV2Input | null = null;

    expect(installed.id).toBe('external.demo-echo@0.1.0');
    expect(resolved?.manifest.displayName).toBe('Demo Echo');
    expect(resolved?.manifest.actions.map((action) => action.name)).toEqual(['read', 'write', 'echo']);
    expect(loadModuleExportKeysWithNode(workerModulePath)).toEqual(['createDemoEchoActionAdapter', 'worker']);
    expect(typeof workerModule.createDemoEchoActionAdapter).toBe('function');

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-demo',
          graph,
          node,
          saveGraph: () => {
            throw new Error('saveGraph should not be called for read');
          }
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-demo-echo-1',
      action: 'read',
      result: {
        content: 'hello demo'
      }
    });

    expect(
      dispatcher.action(
        {
          workspaceId: 'ws-demo',
          graph,
          node,
          saveGraph: (nextGraph) => {
            persistedGraph = nextGraph;
          }
        },
        {
          action: 'write',
          payload: {
            content: 'updated demo'
          }
        }
      )
    ).toEqual({
      nodeId: 'node-demo-echo-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });

    expect(persistedGraph?.nodes[0]?.state.content).toBe('updated demo');
    expect(
      dispatcher.action(
        {
          workspaceId: 'ws-demo',
          graph: persistedGraph ?? graph,
          node: (persistedGraph ?? graph).nodes[0],
          saveGraph: () => {
            throw new Error('saveGraph should not be called for echo');
          }
        },
        {
          action: 'echo',
          payload: {
            suffix: 'pong'
          }
        }
      )
    ).toEqual({
      nodeId: 'node-demo-echo-1',
      action: 'echo',
      ok: true,
      result: {
        content: 'updated demo:pong'
      }
    });
  });
});
