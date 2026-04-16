import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('preload bridge', () => {
  it('exposes the shell bridge with Electron IPC wrappers', async () => {
    const exposeInMainWorld = vi.fn();
    const invoke = vi.fn();

    vi.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld
      },
      ipcRenderer: {
        invoke
      }
    }));

    await import('../../../src/main/preload');

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [bridgeName, bridge] = exposeInMainWorld.mock.calls[0] as [string, Record<string, any>];
    expect(bridgeName).toBe('openweaveShell');
    expect(bridge.platform).toBe(process.platform);

    await bridge.workspaces.listWorkspaces();
    await bridge.canvas.loadCanvasState({ workspaceId: 'ws-1' });
    await bridge.runs.startRun({
      workspaceId: 'ws-1',
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo hello'
    });

    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
