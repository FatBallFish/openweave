import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../../../src/cli/index';
import * as componentCommands from '../../../src/cli/commands/component';
import type {
  GraphNodeActionResponse,
  GraphNodeGetResponse,
  GraphNodeListResponse,
  GraphNodeNeighborsResponse,
  GraphNodeReadResponse,
  WorkspaceInfoResponse
} from '../../../src/shared/ipc/contracts';

interface CliWorkspaceNodeServiceStub {
  resolveWorkspaceId: (input: { workspaceId?: string; cwd: string }) => Promise<string>;
  getWorkspaceInfo: (input: { workspaceId: string }) => Promise<WorkspaceInfoResponse>;
  listNodes: (input: { workspaceId: string }) => Promise<GraphNodeListResponse>;
  getNode: (input: { workspaceId: string; nodeId: string }) => Promise<GraphNodeGetResponse>;
  getNodeNeighbors: (input: { workspaceId: string; nodeId: string }) => Promise<GraphNodeNeighborsResponse>;
  readNode: (input: { workspaceId: string; nodeId: string; mode?: string }) => Promise<GraphNodeReadResponse>;
  runNodeAction: (input: {
    workspaceId: string;
    nodeId: string;
    action: string;
    payload?: Record<string, unknown>;
  }) => Promise<GraphNodeActionResponse>;
}

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

const createService = (): CliWorkspaceNodeServiceStub => ({
  resolveWorkspaceId: vi.fn(async ({ workspaceId }) => workspaceId ?? 'ws-cwd'),
  getWorkspaceInfo: vi.fn(async ({ workspaceId }) => ({
    workspaceId,
    name: 'Demo',
    rootDir: '/repo',
    graphSchemaVersion: 2,
    nodeCount: 2,
    edgeCount: 1
  })),
  listNodes: vi.fn(async () => ({
    nodes: [
      {
        id: 'node-note-1',
        title: 'Requirements',
        componentType: 'builtin.note',
        componentVersion: '1.0.0',
        capabilities: ['read', 'write']
      }
    ]
  })),
  getNode: vi.fn(async ({ nodeId }) => ({
    node: {
      id: nodeId,
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: 'Requirements',
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
        content: '# hi'
      },
      capabilities: ['read', 'write']
    }
  })),
  getNodeNeighbors: vi.fn(async ({ nodeId }) => ({
    nodeId,
    upstream: [
      {
        edgeId: 'edge-1',
        nodeId: 'node-a',
        componentType: 'builtin.note',
        title: 'Upstream'
      }
    ],
    downstream: []
  })),
  readNode: vi.fn(async ({ nodeId }) => ({
    nodeId,
    action: 'read',
    result: {
      content: '# hi'
    }
  })),
  runNodeAction: vi.fn(async ({ nodeId, action }) => ({
    nodeId,
    action,
    ok: true,
    result: {
      updated: true
    }
  }))
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runCli workspace/node commands', () => {
  it('supports workspace info with explicit --workspace and stable JSON output', async () => {
    const service = createService();
    const streams = createStdStreams();

    const exitCode = await runCli(['--workspace', 'ws-123', 'workspace', 'info', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: streams.writeStdout },
      stderr: { write: streams.writeStderr }
    } as never);

    expect(exitCode).toBe(0);
    expect(JSON.parse(streams.stdout.join(''))).toEqual({
      workspaceId: 'ws-123',
      name: 'Demo',
      rootDir: '/repo',
      graphSchemaVersion: 2,
      nodeCount: 2,
      edgeCount: 1
    });
    expect(service.resolveWorkspaceId).toHaveBeenCalledWith({
      workspaceId: 'ws-123',
      cwd: process.cwd()
    });
  });

  it('supports node list/get/neighbors with cwd-based workspace resolution', async () => {
    const service = createService();

    const listStreams = createStdStreams();
    const listExitCode = await runCli(['node', 'list', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: listStreams.writeStdout },
      stderr: { write: listStreams.writeStderr }
    } as never);

    const getStreams = createStdStreams();
    const getExitCode = await runCli(['node', 'get', 'node-note-1', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: getStreams.writeStdout },
      stderr: { write: getStreams.writeStderr }
    } as never);

    const neighborsStreams = createStdStreams();
    const neighborsExitCode = await runCli(['node', 'neighbors', 'node-note-1', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: neighborsStreams.writeStdout },
      stderr: { write: neighborsStreams.writeStderr }
    } as never);

    expect(listExitCode).toBe(0);
    expect(getExitCode).toBe(0);
    expect(neighborsExitCode).toBe(0);
    expect(JSON.parse(listStreams.stdout.join(''))).toEqual({
      nodes: [
        {
          id: 'node-note-1',
          title: 'Requirements',
          componentType: 'builtin.note',
          componentVersion: '1.0.0',
          capabilities: ['read', 'write']
        }
      ]
    });
    expect(JSON.parse(getStreams.stdout.join(''))).toEqual({
      node: {
        id: 'node-note-1',
        componentType: 'builtin.note',
        componentVersion: '1.0.0',
        title: 'Requirements',
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
          content: '# hi'
        },
        capabilities: ['read', 'write']
      }
    });
    expect(JSON.parse(neighborsStreams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      upstream: [
        {
          edgeId: 'edge-1',
          nodeId: 'node-a',
          componentType: 'builtin.note',
          title: 'Upstream'
        }
      ],
      downstream: []
    });
    expect(service.resolveWorkspaceId).toHaveBeenCalledWith({
      workspaceId: undefined,
      cwd: process.cwd()
    });
  });

  it('returns WORKSPACE_NOT_FOUND_FOR_CWD when cwd resolution fails', async () => {
    const service = createService();
    service.resolveWorkspaceId = vi.fn(async () => {
      throw new Error('WORKSPACE_NOT_FOUND_FOR_CWD');
    });
    const streams = createStdStreams();

    const exitCode = await runCli(['workspace', 'info'], {
      workspaceNodeService: service as never,
      stdout: { write: streams.writeStdout },
      stderr: { write: streams.writeStderr }
    } as never);

    expect(exitCode).toBe(1);
    expect(streams.stdout.join('')).toBe('');
    expect(streams.stderr.join('')).toContain('WORKSPACE_NOT_FOUND_FOR_CWD');
  });

  it('does not treat --timeout values as node ids for get/neighbors', async () => {
    const service = createService();

    const getStreams = createStdStreams();
    const getExitCode = await runCli(['node', 'get', '--timeout', '1500', 'node-note-1', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: getStreams.writeStdout },
      stderr: { write: getStreams.writeStderr }
    } as never);

    const neighborsStreams = createStdStreams();
    const neighborsExitCode = await runCli(
      ['node', 'neighbors', '--workspace', 'ws-1', '--timeout', '900', 'node-note-2', '--json'],
      {
        workspaceNodeService: service as never,
        stdout: { write: neighborsStreams.writeStdout },
        stderr: { write: neighborsStreams.writeStderr }
      } as never
    );

    expect(getExitCode).toBe(0);
    expect(neighborsExitCode).toBe(0);
    expect(service.getNode).toHaveBeenCalledWith({
      workspaceId: 'ws-cwd',
      nodeId: 'node-note-1'
    });
    expect(service.getNodeNeighbors).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 'node-note-2'
    });
  });

  it('makes --pretty output different from plain --json output', async () => {
    const service = createService();

    const plainStreams = createStdStreams();
    const plainExitCode = await runCli(['workspace', 'info', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: plainStreams.writeStdout },
      stderr: { write: plainStreams.writeStderr }
    } as never);

    const prettyStreams = createStdStreams();
    const prettyExitCode = await runCli(['workspace', 'info', '--json', '--pretty'], {
      workspaceNodeService: service as never,
      stdout: { write: prettyStreams.writeStdout },
      stderr: { write: prettyStreams.writeStderr }
    } as never);

    expect(plainExitCode).toBe(0);
    expect(prettyExitCode).toBe(0);
    expect(plainStreams.stdout.join('')).not.toBe(prettyStreams.stdout.join(''));
    expect(plainStreams.stdout.join('')).toContain('{"workspaceId":"ws-cwd"');
    expect(prettyStreams.stdout.join('')).toContain('\n  "workspaceId": "ws-cwd"');
  });

  it('does not create component service for workspace/node commands', async () => {
    const service = createService();
    const streams = createStdStreams();
    const createComponentService = vi
      .spyOn(componentCommands, 'createCliComponentService')
      .mockImplementation(() => {
        throw new Error('component service must not be created');
      });

    const exitCode = await runCli(['workspace', 'info', '--json'], {
      workspaceNodeService: service as never,
      stdout: { write: streams.writeStdout },
      stderr: { write: streams.writeStderr }
    } as never);

    expect(exitCode).toBe(0);
    expect(createComponentService).not.toHaveBeenCalled();
  });

  it('supports node read with --mode and forwards mode to readNode service call', async () => {
    const service = createService();
    const streams = createStdStreams();

    const exitCode = await runCli(
      ['node', 'read', 'node-note-1', '--mode', 'content', '--workspace', 'ws-1', '--json'],
      {
        workspaceNodeService: service as never,
        stdout: { write: streams.writeStdout },
        stderr: { write: streams.writeStderr }
      } as never
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(streams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: '# hi'
      }
    });
    expect(service.readNode).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 'node-note-1',
      mode: 'content'
    });
  });

  it('supports node action with --json-input payload', async () => {
    const service = createService();
    const streams = createStdStreams();

    const exitCode = await runCli(
      ['node', 'action', 'node-note-1', 'write', '--json-input', '{"content":"new"}', '--workspace', 'ws-1', '--json'],
      {
        workspaceNodeService: service as never,
        stdout: { write: streams.writeStdout },
        stderr: { write: streams.writeStderr }
      } as never
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(streams.stdout.join(''))).toEqual({
      nodeId: 'node-note-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });
    expect(service.runNodeAction).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 'node-note-1',
      action: 'write',
      payload: {
        content: 'new'
      }
    });
  });

  it('supports node action with --input-file payload', async () => {
    const service = createService();
    const streams = createStdStreams();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-node-action-'));
    const inputFilePath = path.join(tempDir, 'payload.json');
    fs.writeFileSync(inputFilePath, '{"content":"from file"}', 'utf8');

    try {
      const exitCode = await runCli(
        ['node', 'action', 'node-note-1', 'write', '--input-file', inputFilePath, '--workspace', 'ws-1', '--json'],
        {
          workspaceNodeService: service as never,
          stdout: { write: streams.writeStdout },
          stderr: { write: streams.writeStderr }
        } as never
      );

      expect(exitCode).toBe(0);
      expect(JSON.parse(streams.stdout.join(''))).toEqual({
        nodeId: 'node-note-1',
        action: 'write',
        ok: true,
        result: {
          updated: true
        }
      });
      expect(service.runNodeAction).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        nodeId: 'node-note-1',
        action: 'write',
        payload: {
          content: 'from file'
        }
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails node action with malformed --json-input', async () => {
    const service = createService();
    const streams = createStdStreams();

    const exitCode = await runCli(
      ['node', 'action', 'node-note-1', 'write', '--json-input', '{"content":', '--workspace', 'ws-1', '--json'],
      {
        workspaceNodeService: service as never,
        stdout: { write: streams.writeStdout },
        stderr: { write: streams.writeStderr }
      } as never
    );

    expect(exitCode).toBe(1);
    expect(streams.stdout.join('')).toBe('');
    expect(streams.stderr.join('')).toContain('JSON');
    expect(service.runNodeAction).not.toHaveBeenCalled();
  });

  it('fails node action when --input-file does not exist', async () => {
    const service = createService();
    const streams = createStdStreams();
    const missingPath = path.join(os.tmpdir(), `openweave-missing-${Date.now()}.json`);

    const exitCode = await runCli(
      ['node', 'action', 'node-note-1', 'write', '--input-file', missingPath, '--workspace', 'ws-1', '--json'],
      {
        workspaceNodeService: service as never,
        stdout: { write: streams.writeStdout },
        stderr: { write: streams.writeStderr }
      } as never
    );

    expect(exitCode).toBe(1);
    expect(streams.stdout.join('')).toBe('');
    expect(streams.stderr.join('')).toContain('ENOENT');
    expect(service.runNodeAction).not.toHaveBeenCalled();
  });
});
