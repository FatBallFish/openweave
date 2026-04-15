const test = require("node:test");
const assert = require("node:assert/strict");

const { getSmokeRuntimeConfig } = require("../src/runtime-config.cjs");

test("builds a PowerShell-based smoke command for Windows", () => {
  const config = getSmokeRuntimeConfig("win32", {
    SystemRoot: "C:\\Windows",
    USERPROFILE: "C:\\Users\\openweave"
  });

  assert.equal(config.shell, "powershell.exe");
  assert.deepEqual(config.args.slice(0, 3), ["-NoLogo", "-NoProfile", "-Command"]);
  assert.match(config.args[3], /OPENWEAVE_PTY_OK/);
  assert.equal(config.cwd, "C:\\Users\\openweave");
  assert.equal(config.env.SystemRoot, "C:\\Windows");
});

test("builds a POSIX smoke command for non-Windows platforms", () => {
  const config = getSmokeRuntimeConfig("darwin", {
    HOME: "/Users/openweave",
    SHELL: "/bin/zsh"
  });

  assert.equal(config.shell, "/bin/zsh");
  assert.deepEqual(config.args.slice(0, 2), ["-lc", config.args[1]]);
  assert.match(config.args[1], /OPENWEAVE_PTY_OK/);
  assert.equal(config.cwd, "/Users/openweave");
});
