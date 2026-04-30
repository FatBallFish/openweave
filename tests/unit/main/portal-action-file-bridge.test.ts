import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createPortalActionFileClient,
  startPortalActionFileServer
} from '../../../src/main/bridge/portal-action-file-bridge';

let tempDir = '';

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  }
});

describe('portal action file bridge', () => {
  it('round trips portal action requests and returns renderer-backed results', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-portal-action-'));
    const requestsDir = path.join(tempDir, 'requests');
    const received: Array<{
      workspaceId: string;
      targetNodeId: string;
      action: string;
      payload?: Record<string, unknown>;
    }> = [];
    const stopServer = startPortalActionFileServer({
      requestsDir,
      pollIntervalMs: 5,
      dispatch: async (input) => {
        received.push(input);
        return {
          path: '/tmp/openweave/capture.png',
          elements: [{ tag: 'button', text: 'Run' }]
        };
      }
    });

    try {
      const client = createPortalActionFileClient({
        requestsDir,
        pollIntervalMs: 5,
        timeoutMs: 1000
      });

      await expect(
        client.dispatch({
          workspaceId: 'ws-1',
          targetNodeId: 'portal-1',
          action: 'read-structure',
          payload: {}
        })
      ).resolves.toEqual({
        path: '/tmp/openweave/capture.png',
        elements: [{ tag: 'button', text: 'Run' }]
      });

      expect(received).toEqual([
        {
          workspaceId: 'ws-1',
          targetNodeId: 'portal-1',
          action: 'read-structure',
          payload: {}
        }
      ]);
    } finally {
      stopServer();
    }
  });
});
