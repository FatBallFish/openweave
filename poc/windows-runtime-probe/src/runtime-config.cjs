const SUCCESS_MARKER = "OPENWEAVE_PTY_OK";

function getWindowsHome(env) {
  if (env.USERPROFILE) {
    return env.USERPROFILE;
  }

  if (env.HOMEDRIVE && env.HOMEPATH) {
    return `${env.HOMEDRIVE}${env.HOMEPATH}`;
  }

  return process.cwd();
}

function getPosixHome(env) {
  return env.HOME || process.cwd();
}

function getSmokeRuntimeConfig(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    return {
      platform,
      shell: env.OPENWEAVE_WINDOWS_SHELL || "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-Command",
        `Write-Output '${SUCCESS_MARKER}'; exit 0`
      ],
      cwd: getWindowsHome(env),
      env: {
        ...env
      }
    };
  }

  return {
    platform,
    shell: env.SHELL || "/bin/bash",
    args: ["-lc", `printf '${SUCCESS_MARKER}\\n'`],
    cwd: getPosixHome(env),
    env: {
      ...env
    }
  };
}

module.exports = {
  SUCCESS_MARKER,
  getSmokeRuntimeConfig
};
