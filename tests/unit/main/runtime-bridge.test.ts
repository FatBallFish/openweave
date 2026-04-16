import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRuntimeWorkerPath } from '../../../src/main/runtime/runtime-bridge';

describe('resolveRuntimeWorkerPath', () => {
  it('resolves the packaged worker entry from the app dist tree', () => {
    const appRootDir = '/Applications/OpenWeave.app/Contents/Resources/app';
    const runtimeDir = path.join(appRootDir, 'dist', 'main', 'runtime');

    const workerPath = resolveRuntimeWorkerPath({
      runtimeDir,
      cwd: '/tmp/ignored',
      pathExists: (candidate: string) =>
        candidate === path.join(appRootDir, 'dist', 'worker', 'runtime-worker.js')
    });

    expect(workerPath).toBe(path.join(appRootDir, 'dist', 'worker', 'runtime-worker.js'));
  });

  it('falls back to the cwd dist worker entry for local development', () => {
    const cwd = '/workspace/openweave';

    const workerPath = resolveRuntimeWorkerPath({
      runtimeDir: path.join(cwd, 'dist', 'main', 'runtime'),
      cwd,
      pathExists: (candidate: string) =>
        candidate === path.join(cwd, 'dist', 'worker', 'runtime-worker.js')
    });

    expect(workerPath).toBe(path.join(cwd, 'dist', 'worker', 'runtime-worker.js'));
  });

  it('throws when no known worker path exists', () => {
    expect(() =>
      resolveRuntimeWorkerPath({
        runtimeDir: '/missing/runtime',
        cwd: '/missing',
        pathExists: () => false
      })
    ).toThrow('Runtime worker entry not found');
  });
});
