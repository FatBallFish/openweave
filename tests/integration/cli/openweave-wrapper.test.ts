import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';
import { createWorkspaceRepository, type WorkspaceRepository } from '../../../src/main/db/workspace';

let tempDir = '';
let registryDbFilePath = '';
let workspaceDbDir = '';
let workspaceRootDir = '';
let workspaceId = '';
let registry: RegistryRepository | null = null;
let workspaceRepository: WorkspaceRepository | null = null;

const toWorkspaceDbPath = (id: string): string => {
  return path.join(workspaceDbDir, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`);
};

const resolveWrapperCommand = (): { file: string; args: string[] } => {
  const wrapperPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'bin',
    process.platform === 'win32' ? 'openweave.cmd' : 'openweave'
  );

  if (process.platform === 'win32') {
    return {
      file: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', wrapperPath]
    };
  }

  return {
    file: wrapperPath,
    args: []
  };
};

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-wrapper-'));
  registryDbFilePath = path.join(tempDir, 'registry.sqlite');
  workspaceDbDir = path.join(tempDir, 'workspaces');
  workspaceRootDir = path.join(tempDir, 'repo');
  fs.mkdirSync(workspaceDbDir, { recursive: true });
  fs.mkdirSync(workspaceRootDir, { recursive: true });
  workspaceRootDir = fs.realpathSync(workspaceRootDir);

  registry = createRegistryRepository({ dbFilePath: registryDbFilePath });
  workspaceId = registry.createWorkspace({
    name: 'CLI Wrapper Demo',
    rootDir: workspaceRootDir
  }).id;

  workspaceRepository = createWorkspaceRepository({
    dbFilePath: toWorkspaceDbPath(workspaceId)
  });
  workspaceRepository.saveGraphSnapshot({
    schemaVersion: 2,
    nodes: [],
    edges: []
  });
});

afterEach(() => {
  workspaceRepository?.close();
  workspaceRepository = null;
  registry?.close();
  registry = null;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  }
});

describe('openweave CLI wrapper', () => {
  it('boots the CLI through the wrapper so terminals can call `openweave` directly', () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });
    const command = resolveWrapperCommand();

    const result = spawnSync(
      command.file,
      [...command.args, 'workspace', 'info', '--json'],
      {
        cwd: nestedCwd,
        env: {
          ...process.env,
          OPENWEAVE_CLI_ENTRY: path.resolve(__dirname, '..', '..', '..', 'dist', 'cli', 'index.js'),
          OPENWEAVE_CLI_RUNTIME: process.execPath,
          OPENWEAVE_REGISTRY_DB_PATH: registryDbFilePath,
          OPENWEAVE_WORKSPACE_DB_DIR: workspaceDbDir
        },
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      workspaceId,
      name: 'CLI Wrapper Demo',
      rootDir: workspaceRootDir,
      graphSchemaVersion: 2,
      nodeCount: 0,
      edgeCount: 0
    });
  });
});
