import path from 'node:path';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPackagePlan } = require('../../../deploy/package-plan.cjs') as {
  buildPackagePlan: (input: { platform: string; arch: string; projectDir?: string }) => {
    platformName: string;
    outputDir: string;
    builderArgs: string[];
  };
};

describe('buildPackagePlan', () => {
  const projectDir = '/workspace/openweave';

  it('builds macOS dmg and zip artifacts into deploy/target/macos', () => {
    const plan = buildPackagePlan({
      platform: 'darwin',
      arch: 'arm64',
      projectDir
    });

    expect(plan.platformName).toBe('macos');
    expect(plan.outputDir).toBe(path.join(projectDir, 'deploy', 'target', 'macos'));
    expect(plan.builderArgs).toEqual(['--mac', 'dmg', 'zip', '--arm64']);
  });

  it('builds Linux AppImage artifacts into deploy/target/linux', () => {
    const plan = buildPackagePlan({
      platform: 'linux',
      arch: 'x64',
      projectDir
    });

    expect(plan.platformName).toBe('linux');
    expect(plan.outputDir).toBe(path.join(projectDir, 'deploy', 'target', 'linux'));
    expect(plan.builderArgs).toEqual(['--linux', 'AppImage', '--x64']);
  });

  it('builds Windows nsis artifacts into deploy/target/windows', () => {
    const plan = buildPackagePlan({
      platform: 'win32',
      arch: 'x64',
      projectDir
    });

    expect(plan.platformName).toBe('windows');
    expect(plan.outputDir).toBe(path.join(projectDir, 'deploy', 'target', 'windows'));
    expect(plan.builderArgs).toEqual(['--win', 'nsis', '--x64']);
  });

  it('rejects unsupported host platforms', () => {
    expect(() =>
      buildPackagePlan({
        platform: 'freebsd',
        arch: 'x64',
        projectDir
      })
    ).toThrow('Unsupported packaging platform: freebsd');
  });
});
