import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../../../src/cli/index';
import { createCliWorkspaceNodeService, type CliWorkspaceNodeService } from '../../../src/cli/commands/workspace';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';
import { createWorkspaceRepository, type WorkspaceRepository } from '../../../src/main/db/workspace';

let tempDir = '';
let registryDbFilePath = '';
let workspaceDbDir = '';
let workspaceRootDir = '';
let workspaceId = '';
let registry: RegistryRepository | null = null;
let workspaceRepository: WorkspaceRepository | null = null;
let workspaceNodeService: CliWorkspaceNodeService | null = null;

const createStdStreams = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeStdout: (value: string) => {
      stdout.push(value);
    },
    writeStderr: (value: string) => {
      stderr.push(value);
    }
  };
};

const toWorkspaceDbPath = (id: string): string => {
  return path.join(workspaceDbDir, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`);
};

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-roundtrip-'));
  registryDbFilePath = path.join(tempDir, 'registry.sqlite');
  workspaceDbDir = path.join(tempDir, 'workspaces');
  workspaceRootDir = path.join(tempDir, 'repo');
  fs.mkdirSync(workspaceDbDir, { recursive: true });
  fs.mkdirSync(workspaceRootDir, { recursive: true });
  workspaceRootDir = fs.realpathSync(workspaceRootDir);

  registry = createRegistryRepository({ dbFilePath: registryDbFilePath });
  workspaceId = registry.createWorkspace({
    name: 'CLI Demo',
    rootDir: workspaceRootDir
  }).id;

  workspaceRepository = createWorkspaceRepository({
    dbFilePath: toWorkspaceDbPath(workspaceId)
  });
  workspaceRepository.saveGraphSnapshot({
    schemaVersion: 2,
    nodes: [
      {
        id: 'node-note-1',
        componentType: 'builtin.note',
        componentVersion: '1.0.0',
        title: 'Note',
        bounds: {
          x: 10,
          y: 20,
          width: 320,
          height: 240
        },
        config: {
          mode: 'markdown'
        },
        state: {
          content: '# hello'
        },
        capabilities: ['read', 'write'],
        createdAtMs: 1,
        updatedAtMs: 2
      },
      {
        id: 'node-terminal-1',
        componentType: 'builtin.terminal',
        componentVersion: '1.0.0',
        title: 'Terminal',
        bounds: {
          x: 400,
          y: 20,
          width: 420,
          height: 260
        },
        config: {
          runtime: 'shell'
        },
        state: {
          activeSessionId: null
        },
        capabilities: ['read', 'write', 'execute', 'stream'],
        createdAtMs: 3,
        updatedAtMs: 4
      }
    ],
    edges: [
      {
        id: 'edge-note-terminal',
        source: 'node-note-1',
        target: 'node-terminal-1',
        sourceHandle: 'context',
        targetHandle: 'input',
        label: 'feeds',
        meta: {
          kind: 'context'
        },
        createdAtMs: 5,
        updatedAtMs: 6
      }
    ]
  });

  workspaceNodeService = createCliWorkspaceNodeService({
    env: {
      OPENWEAVE_REGISTRY_DB_PATH: registryDbFilePath,
      OPENWEAVE_WORKSPACE_DB_DIR: workspaceDbDir
    }
  });
});

afterEach(() => {
  workspaceNodeService?.close?.();
  workspaceNodeService = null;
  workspaceRepository?.close();
  workspaceRepository = null;
  registry?.close();
  registry = null;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  }
});

describe('CLI -> local bridge roundtrip', () => {
  it('resolves workspace from cwd and returns stable JSON for workspace info and node list/get/neighbors', async () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });

    const infoStreams = createStdStreams();
    const infoExitCode = await runCli(['workspace', 'info', '--json'], {
      workspaceNodeService: workspaceNodeService ?? undefined,
      cwd: nestedCwd,
      stdout: { write: infoStreams.writeStdout },
      stderr: { write: infoStreams.writeStderr }
    });

    const listStreams = createStdStreams();
    const listExitCode = await runCli(['node', 'list', '--workspace', workspaceId, '--json'], {
      workspaceNodeService: workspaceNodeService ?? undefined,
      cwd: nestedCwd,
      stdout: { write: listStreams.writeStdout },
      stderr: { write: listStreams.writeStderr }
    });

    const getStreams = createStdStreams();
    const getExitCode = await runCli(['node', 'get', 'node-note-1', '--workspace', workspaceId, '--json'], {
      workspaceNodeService: workspaceNodeService ?? undefined,
      cwd: nestedCwd,
      stdout: { write: getStreams.writeStdout },
      stderr: { write: getStreams.writeStderr }
    });

    const neighborsStreams = createStdStreams();
    const neighborsExitCode = await runCli(
      ['node', 'neighbors', 'node-note-1', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: neighborsStreams.writeStdout },
        stderr: { write: neighborsStreams.writeStderr }
      }
    );

    expect(infoExitCode).toBe(0);
    expect(listExitCode).toBe(0);
    expect(getExitCode).toBe(0);
    expect(neighborsExitCode).toBe(0);
    expect(JSON.parse(infoStreams.stdout.join(''))).toEqual({
      workspaceId,
      name: 'CLI Demo',
      rootDir: workspaceRootDir,
      graphSchemaVersion: 2,
      nodeCount: 2,
      edgeCount: 1
    });
    expect(JSON.parse(listStreams.stdout.join(''))).toEqual({
      nodes: [
        {
          id: 'node-note-1',
          title: 'Note',
          componentType: 'builtin.note',
          componentVersion: '1.0.0',
          capabilities: ['read', 'write']
        },
        {
          id: 'node-terminal-1',
          title: 'Terminal',
          componentType: 'builtin.terminal',
          componentVersion: '1.0.0',
          capabilities: ['read', 'write', 'execute', 'stream']
        }
      ]
    });
    expect(JSON.parse(getStreams.stdout.join('')).node.id).toBe('node-note-1');
    expect(JSON.parse(neighborsStreams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      upstream: [],
      downstream: [
        {
          edgeId: 'edge-note-terminal',
          nodeId: 'node-terminal-1',
          componentType: 'builtin.terminal',
          title: 'Terminal'
        }
      ]
    });
    expect(JSON.parse(getStreams.stdout.join(''))).toEqual({
      node: {
        id: 'node-note-1',
        componentType: 'builtin.note',
        componentVersion: '1.0.0',
        title: 'Note',
        bounds: {
          x: 10,
          y: 20,
          width: 320,
          height: 240
        },
        config: {
          mode: 'markdown'
        },
        state: {
          content: '# hello'
        },
        capabilities: ['read', 'write']
      }
    });
  });

  it('writes note content via node action then reads updated content', async () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });

    const actionStreams = createStdStreams();
    const actionExitCode = await runCli(
      ['node', 'action', 'node-note-1', 'write', '--workspace', workspaceId, '--json-input', '{"content":"new"}', '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: actionStreams.writeStdout },
        stderr: { write: actionStreams.writeStderr }
      }
    );

    const readStreams = createStdStreams();
    const readExitCode = await runCli(
      ['node', 'read', 'node-note-1', '--mode', 'content', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: readStreams.writeStdout },
        stderr: { write: readStreams.writeStderr }
      }
    );

    expect(actionExitCode).toBe(0);
    expect(readExitCode).toBe(0);
    expect(JSON.parse(actionStreams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });
    expect(JSON.parse(readStreams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: 'new'
      }
    });
  });

  it('supports node action input from --input-file', async () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });
    const payloadFilePath = path.join(tempDir, 'node-action-input.json');
    fs.writeFileSync(payloadFilePath, '{"content":"from file"}', 'utf8');

    const actionStreams = createStdStreams();
    const actionExitCode = await runCli(
      ['node', 'action', 'node-note-1', 'write', '--workspace', workspaceId, '--input-file', payloadFilePath, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: actionStreams.writeStdout },
        stderr: { write: actionStreams.writeStderr }
      }
    );

    const readStreams = createStdStreams();
    const readExitCode = await runCli(
      ['node', 'read', 'node-note-1', '--mode', 'content', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: readStreams.writeStdout },
        stderr: { write: readStreams.writeStderr }
      }
    );

    expect(actionExitCode).toBe(0);
    expect(readExitCode).toBe(0);
    expect(JSON.parse(actionStreams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });
    expect(JSON.parse(readStreams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: 'from file'
      }
    });
  });

  it('returns the existing validation error for invalid note write payloads', async () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });
    const actionStreams = createStdStreams();

    const actionExitCode = await runCli(
      ['node', 'action', 'node-note-1', 'write', '--workspace', workspaceId, '--json-input', '{}', '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: actionStreams.writeStdout },
        stderr: { write: actionStreams.writeStderr }
      }
    );

    expect(actionExitCode).toBe(1);
    expect(actionStreams.stdout.join('')).toBe('');
    expect(actionStreams.stderr.join('')).toContain('Invalid payload: content must be a string');
  });

  it('returns NODE_ACTION_NOT_SUPPORTED for unsupported read mode', async () => {
    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });
    const readStreams = createStdStreams();

    const readExitCode = await runCli(
      ['node', 'read', 'node-note-1', '--mode', 'summary', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: readStreams.writeStdout },
        stderr: { write: readStreams.writeStderr }
      }
    );

    expect(readExitCode).toBe(1);
    expect(readStreams.stdout.join('')).toBe('');
    expect(readStreams.stderr.join('')).toContain('NODE_ACTION_NOT_SUPPORTED');
  });

  it('supports builtin.text/builtin.attachment read --json and rejects unsupported action', async () => {
    workspaceRepository?.saveGraphSnapshot({
      schemaVersion: 2,
      nodes: [
        {
          id: 'node-text-1',
          componentType: 'builtin.text',
          componentVersion: '1.0.0',
          title: 'Text',
          bounds: {
            x: 10,
            y: 20,
            width: 320,
            height: 240
          },
          config: {
            mode: 'plain'
          },
          state: {
            content: 'hello text'
          },
          capabilities: ['read'],
          createdAtMs: 1,
          updatedAtMs: 2
        },
        {
          id: 'node-attachment-1',
          componentType: 'builtin.attachment',
          componentVersion: '1.0.0',
          title: 'Attachment',
          bounds: {
            x: 400,
            y: 20,
            width: 420,
            height: 260
          },
          config: {},
          state: {
            attachments: [
              {
                id: 'att-1',
                name: 'design.pdf',
                path: '/tmp/design.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 1234
              },
              {
                id: 'att-2',
                name: 'notes.txt',
                path: '/tmp/notes.txt'
              }
            ]
          },
          capabilities: ['read'],
          createdAtMs: 3,
          updatedAtMs: 4
        }
      ],
      edges: []
    });

    const nestedCwd = path.join(workspaceRootDir, 'packages', 'ui');
    fs.mkdirSync(nestedCwd, { recursive: true });

    const textReadStreams = createStdStreams();
    const textReadExitCode = await runCli(
      ['node', 'read', 'node-text-1', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: textReadStreams.writeStdout },
        stderr: { write: textReadStreams.writeStderr }
      }
    );

    const attachmentReadStreams = createStdStreams();
    const attachmentReadExitCode = await runCli(
      ['node', 'read', 'node-attachment-1', '--mode', 'content', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: attachmentReadStreams.writeStdout },
        stderr: { write: attachmentReadStreams.writeStderr }
      }
    );

    const attachmentActionStreams = createStdStreams();
    const attachmentActionExitCode = await runCli(
      ['node', 'action', 'node-attachment-1', 'write', '--workspace', workspaceId, '--json'],
      {
        workspaceNodeService: workspaceNodeService ?? undefined,
        cwd: nestedCwd,
        stdout: { write: attachmentActionStreams.writeStdout },
        stderr: { write: attachmentActionStreams.writeStderr }
      }
    );

    expect(textReadExitCode).toBe(0);
    expect(attachmentReadExitCode).toBe(0);
    expect(attachmentActionExitCode).toBe(1);
    expect(JSON.parse(textReadStreams.stdout.join(''))).toEqual({
      nodeId: 'node-text-1',
      action: 'read',
      result: {
        content: 'hello text'
      }
    });
    expect(JSON.parse(attachmentReadStreams.stdout.join(''))).toEqual({
      nodeId: 'node-attachment-1',
      action: 'read',
      result: {
        content: '2 attachments: design.pdf, notes.txt',
        count: 2,
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            name: 'notes.txt',
            path: '/tmp/notes.txt',
            mimeType: null,
            sizeBytes: null
          }
        ]
      }
    });
    expect(attachmentActionStreams.stdout.join('')).toBe('');
    expect(attachmentActionStreams.stderr.join('')).toContain('NODE_ACTION_NOT_SUPPORTED');
  });
});
