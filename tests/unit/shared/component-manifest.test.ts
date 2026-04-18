import { describe, expect, it } from 'vitest';
import { componentManifestSchemaV1 } from '../../../src/shared/components/manifest';

const createValidManifest = () => ({
  manifestVersion: 1,
  name: 'builtin.note',
  version: '1.0.0',
  displayName: ' Note ',
  category: 'knowledge',
  kind: 'builtin',
  description: 'Editable markdown note component',
  entry: {
    renderer: 'renderer/index.js',
    worker: 'worker/index.js'
  },
  node: {
    defaultTitle: 'New Note',
    defaultSize: {
      width: 360,
      height: 240
    },
    minSize: {
      width: 240,
      height: 160
    }
  },
  schema: {
    config: {
      type: 'object'
    },
    state: {
      type: 'object'
    }
  },
  capabilities: ['read', 'write'],
  actions: [
    {
      name: 'read',
      description: 'Read note content',
      inputSchema: 'schemas/action.read.input.json',
      outputSchema: 'schemas/action.read.output.json',
      idempotent: true
    }
  ],
  permissions: {
    fs: 'none',
    network: 'none',
    process: 'none'
  },
  compatibility: {
    openweave: '>=0.2.0',
    platforms: ['darwin', 'linux', 'win32']
  }
});

describe('componentManifestSchemaV1', () => {
  it('parses a valid manifest and trims display fields', () => {
    const manifest = componentManifestSchemaV1.parse(createValidManifest());

    expect(manifest.displayName).toBe('Note');
    expect(manifest.capabilities).toEqual(['read', 'write']);
    expect(manifest.actions[0]?.name).toBe('read');
  });

  it('rejects unknown capabilities and duplicate action names', () => {
    expect(() =>
      componentManifestSchemaV1.parse({
        ...createValidManifest(),
        capabilities: ['read', 'teleport']
      })
    ).toThrow();

    expect(() =>
      componentManifestSchemaV1.parse({
        ...createValidManifest(),
        actions: [
          {
            name: 'read',
            description: 'Read note content',
            inputSchema: 'schemas/action.read.input.json',
            outputSchema: 'schemas/action.read.output.json',
            idempotent: true
          },
          {
            name: 'read',
            description: 'Read note content again',
            inputSchema: 'schemas/action.read.input.json',
            outputSchema: 'schemas/action.read.output.json',
            idempotent: true
          }
        ]
      })
    ).toThrow('Action names must be unique');
  });

  it('rejects unsafe entry paths that escape the component package', () => {
    expect(() =>
      componentManifestSchemaV1.parse({
        ...createValidManifest(),
        entry: {
          renderer: '../renderer/index.js',
          worker: 'worker/index.js'
        }
      })
    ).toThrow('Entry path must stay within the component package');
  });

  it('rejects blank renderer and worker entries', () => {
    expect(() =>
      componentManifestSchemaV1.parse({
        ...createValidManifest(),
        entry: {
          renderer: '   ',
          worker: 'worker/index.js'
        }
      })
    ).toThrow();

    expect(() =>
      componentManifestSchemaV1.parse({
        ...createValidManifest(),
        entry: {
          renderer: 'renderer/index.js',
          worker: ''
        }
      })
    ).toThrow();
  });
});
