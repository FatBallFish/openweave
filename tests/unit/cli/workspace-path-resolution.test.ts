import { describe, expect, it } from 'vitest';
import { resolveCliWorkspaceNodeRuntimeOptions } from '../../../src/cli/commands/workspace';

describe('resolveCliWorkspaceNodeRuntimeOptions', () => {
  it('prefers explicit registry/workspace overrides when provided', () => {
    const runtime = resolveCliWorkspaceNodeRuntimeOptions({
      env: {
        OPENWEAVE_USER_DATA_DIR: '/tmp/openweave-user-data',
        OPENWEAVE_REGISTRY_DB_PATH: '/tmp/custom/registry.sqlite',
        OPENWEAVE_WORKSPACE_DB_DIR: '/tmp/custom/workspaces'
      },
      platform: 'linux',
      homeDir: '/home/demo'
    });

    expect(runtime).toEqual({
      registryDbFilePath: '/tmp/custom/registry.sqlite',
      workspaceDbDir: '/tmp/custom/workspaces'
    });
  });

  it('uses OPENWEAVE_USER_DATA_DIR for defaults when explicit db paths are absent', () => {
    const runtime = resolveCliWorkspaceNodeRuntimeOptions({
      env: {
        OPENWEAVE_USER_DATA_DIR: '/tmp/openweave-user-data'
      },
      platform: 'linux',
      homeDir: '/home/demo'
    });

    expect(runtime).toEqual({
      registryDbFilePath: '/tmp/openweave-user-data/registry.db',
      workspaceDbDir: '/tmp/openweave-user-data/workspaces'
    });
  });

  it('falls back to openweave userData-style defaults when no overrides are set', () => {
    const linuxRuntime = resolveCliWorkspaceNodeRuntimeOptions({
      env: {},
      platform: 'linux',
      homeDir: '/home/demo'
    });
    const darwinRuntime = resolveCliWorkspaceNodeRuntimeOptions({
      env: {},
      platform: 'darwin',
      homeDir: '/Users/demo'
    });

    expect(linuxRuntime).toEqual({
      registryDbFilePath: '/home/demo/.config/openweave/registry.db',
      workspaceDbDir: '/home/demo/.config/openweave/workspaces'
    });
    expect(darwinRuntime).toEqual({
      registryDbFilePath: '/Users/demo/Library/Application Support/openweave/registry.db',
      workspaceDbDir: '/Users/demo/Library/Application Support/openweave/workspaces'
    });
  });
});
