import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenWeaveCliLaunchEnv, resolveOpenWeaveCliAssets } from '../../../src/main/openweave-cli';

describe('openweave CLI launch assets', () => {
  it('resolves the repo-local CLI wrapper and entry during development', () => {
    const projectRoot = '/tmp/openweave-dev';
    const runtimeDir = path.join(projectRoot, 'dist', 'main');
    const cli = resolveOpenWeaveCliAssets({
      appIsPackaged: false,
      runtimeDir,
      executablePath: '/tmp/electron/Electron',
      processPlatform: 'darwin',
      pathExists: (candidate) =>
        candidate === path.join(projectRoot, 'bin', 'openweave') ||
        candidate === path.join(projectRoot, 'dist', 'cli', 'index.js')
    });

    expect(cli).toEqual({
      commandPath: path.join(projectRoot, 'bin', 'openweave'),
      commandDirectory: path.join(projectRoot, 'bin'),
      entryPath: path.join(projectRoot, 'dist', 'cli', 'index.js'),
      runtimePath: '/tmp/electron/Electron'
    });
  });

  it('resolves the packaged CLI wrapper and entry from app resources', () => {
    const executablePath = '/Applications/OpenWeave.app/Contents/MacOS/OpenWeave';
    const cli = resolveOpenWeaveCliAssets({
      appIsPackaged: true,
      runtimeDir: '/Applications/OpenWeave.app/Contents/Resources/app/dist/main',
      executablePath,
      processPlatform: 'darwin',
      pathExists: (candidate) =>
        candidate === '/Applications/OpenWeave.app/Contents/Resources/bin/openweave' ||
        candidate === '/Applications/OpenWeave.app/Contents/Resources/app/dist/cli/index.js'
    });

    expect(cli).toEqual({
      commandPath: '/Applications/OpenWeave.app/Contents/Resources/bin/openweave',
      commandDirectory: '/Applications/OpenWeave.app/Contents/Resources/bin',
      entryPath: '/Applications/OpenWeave.app/Contents/Resources/app/dist/cli/index.js',
      runtimePath: executablePath
    });
  });

  it('injects PATH and CLI fallback variables for terminal launches', () => {
    const env = buildOpenWeaveCliLaunchEnv({
      baseEnv: {
        PATH: '/usr/bin:/bin'
      },
      cli: {
        commandPath: '/tmp/openweave/bin/openweave',
        commandDirectory: '/tmp/openweave/bin',
        entryPath: '/tmp/openweave/dist/cli/index.js',
        runtimePath: '/tmp/openweave/OpenWeave'
      }
    });

    expect(env.PATH).toBe('/tmp/openweave/bin:/usr/bin:/bin');
    expect(env.OPENWEAVE_CLI).toBe('/tmp/openweave/bin/openweave');
    expect(env.OPENWEAVE_CLI_ENTRY).toBe('/tmp/openweave/dist/cli/index.js');
    expect(env.OPENWEAVE_CLI_RUNTIME).toBe('/tmp/openweave/OpenWeave');
  });
});
