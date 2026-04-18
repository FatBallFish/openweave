import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadComponentManifest } from '../../../src/main/components/manifest-loader';

const createManifest = (overrides: Record<string, unknown> = {}) => ({
  manifestVersion: 1,
  name: 'builtin.note',
  version: '1.0.0',
  displayName: 'Builtin Note',
  category: 'knowledge',
  kind: 'builtin',
  description: 'Editable note component',
  entry: {
    renderer: 'renderer/index.js',
    worker: 'worker/index.js'
  },
  node: {
    defaultTitle: 'Note',
    defaultSize: {
      width: 320,
      height: 200
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
  capabilities: ['read'],
  actions: [
    {
      name: 'read',
      description: 'Read note',
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
    openweave: '>=0.1.0',
    platforms: [process.platform]
  },
  ...overrides
});

let testDir = '';

afterEach(() => {
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('loadComponentManifest', () => {
  const createPackageRoot = (): string => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-component-loader-'));
    fs.mkdirSync(path.join(testDir, 'renderer'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'worker'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'renderer', 'index.js'), 'export {}\n');
    fs.writeFileSync(path.join(testDir, 'worker', 'index.js'), 'export {}\n');
    return testDir;
  };

  it('loads and resolves a component.json manifest from a package root', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(createManifest(), null, 2)
    );

    const result = loadComponentManifest({
      packageRoot,
      appVersion: '0.1.0'
    });

    expect(result.packageRoot).toBe(fs.realpathSync(packageRoot));
    expect(result.manifest.name).toBe('builtin.note');
    expect(result.entry.renderer).toBe(path.join(fs.realpathSync(packageRoot), 'renderer', 'index.js'));
    expect(result.entry.worker).toBe(path.join(fs.realpathSync(packageRoot), 'worker', 'index.js'));
  });

  it('rejects manifests that are incompatible with the current app version', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          compatibility: {
            openweave: '>=9.0.0',
            platforms: [process.platform]
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '0.1.0'
      })
    ).toThrow('is not compatible with OpenWeave 0.1.0');
  });

  it('rejects entry paths that resolve outside the package root at load time', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          entry: {
            renderer: 'renderer/index.js',
            worker: 'nested/../..//outside.js'
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '0.1.0'
      })
    ).toThrow('Entry path must stay within the component package');
  });

  it('rejects entry paths that escape through a symlink after canonicalization', () => {
    const packageRoot = createPackageRoot();
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-component-loader-outside-'));
    const outsideWorkerPath = path.join(outsideDir, 'worker.js');
    fs.writeFileSync(outsideWorkerPath, 'export {}\n');
    fs.mkdirSync(path.join(packageRoot, 'links'), { recursive: true });
    fs.symlinkSync(outsideDir, path.join(packageRoot, 'links', 'outside'));

    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          entry: {
            renderer: 'renderer/index.js',
            worker: 'links/outside/worker.js'
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '0.1.0'
      })
    ).toThrow('Entry path must stay within the component package');

    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('rejects unsupported compatibility expressions instead of partially parsing them', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          compatibility: {
            openweave: '>=0.1.0 <2.0.0',
            platforms: [process.platform]
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '0.1.0'
      })
    ).toThrow('Unsupported compatibility expression');
  });

  it('accepts prerelease and build metadata in supported compatibility forms', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          compatibility: {
            openweave: '>=1.2.3-alpha.1+manifest.5',
            platforms: [process.platform]
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '1.2.3-beta.2+app.9'
      })
    ).not.toThrow();
  });

  it('uses semver prerelease precedence for >= compatibility checks', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          compatibility: {
            openweave: '>=1.2.3-beta.2',
            platforms: [process.platform]
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '1.2.3-beta.1'
      })
    ).toThrow('is not compatible with OpenWeave 1.2.3-beta.1');
  });

  it('ignores build metadata when matching exact compatibility', () => {
    const packageRoot = createPackageRoot();
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(
        createManifest({
          compatibility: {
            openweave: '=1.2.3+manifest.7',
            platforms: [process.platform]
          }
        }),
        null,
        2
      )
    );

    expect(() =>
      loadComponentManifest({
        packageRoot,
        appVersion: '1.2.3+app.2'
      })
    ).not.toThrow();
  });
});
