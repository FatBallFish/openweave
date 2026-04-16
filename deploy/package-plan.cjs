const path = require('node:path');

const PLATFORM_PLANS = {
  darwin: {
    platformName: 'macos',
    builderArgs: ['--mac', 'dmg', 'zip']
  },
  linux: {
    platformName: 'linux',
    builderArgs: ['--linux', 'AppImage']
  },
  win32: {
    platformName: 'windows',
    builderArgs: ['--win', 'nsis']
  }
};

const SUPPORTED_ARCHES = new Set(['arm64', 'x64']);

const normalizeArch = (arch) => {
  if (!SUPPORTED_ARCHES.has(arch)) {
    throw new Error(`Unsupported packaging arch: ${arch}`);
  }

  return `--${arch}`;
};

const buildPackagePlan = ({ platform, arch, projectDir = process.cwd() }) => {
  const platformPlan = PLATFORM_PLANS[platform];
  if (!platformPlan) {
    throw new Error(`Unsupported packaging platform: ${platform}`);
  }

  return {
    platformName: platformPlan.platformName,
    outputDir: path.join(projectDir, 'deploy', 'target', platformPlan.platformName),
    builderArgs: [...platformPlan.builderArgs, normalizeArch(arch)]
  };
};

module.exports = {
  buildPackagePlan
};
