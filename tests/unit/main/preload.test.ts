import { afterEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('preload bridge', () => {
  it('exposes additive graph, component, and run controls with the expected IPC channels and payloads', async () => {
    const exposeInMainWorld = vi.fn();
    const invoke = vi.fn();

    vi.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld
      },
      ipcRenderer: {
        invoke,
        on: vi.fn()
      }
    }));

    await import('../../../src/main/preload');

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [bridgeName, bridge] = exposeInMainWorld.mock.calls[0] as [string, Record<string, any>];
    expect(bridgeName).toBe('openweaveShell');
    expect(bridge.platform).toBe(process.platform);
    expect(bridge.ipcChannels.componentList).toBe(IPC_CHANNELS.componentList);
    expect(bridge.ipcChannels.componentInstall).toBe(IPC_CHANNELS.componentInstall);
    expect(bridge.ipcChannels.componentUninstall).toBe(IPC_CHANNELS.componentUninstall);
    expect(bridge.ipcChannels.graphLoad).toBe(IPC_CHANNELS.graphLoad);
    expect(bridge.ipcChannels.graphSave).toBe(IPC_CHANNELS.graphSave);
    expect(bridge.ipcChannels.runInput).toBe(IPC_CHANNELS.runInput);
    expect(bridge.ipcChannels.runStop).toBe(IPC_CHANNELS.runStop);
    expect(typeof bridge.graph.loadGraphSnapshot).toBe('function');
    expect(typeof bridge.graph.saveGraphSnapshot).toBe('function');
    expect(typeof bridge.runs.inputRun).toBe('function');
    expect(typeof bridge.runs.stopRun).toBe('function');

    const graphLoadPayload = { workspaceId: 'ws-1' };
    const graphSavePayload = {
      workspaceId: 'ws-1',
      graphSnapshot: {
        schemaVersion: 2,
        nodes: [],
        edges: []
      }
    };
    const listPayload = {};
    const installPayload = {
      sourceType: 'directory',
      sourcePath: '/tmp/component-dir'
    };
    const uninstallPayload = { name: 'external.note', version: '1.0.0' };
    const inputPayload = {
      workspaceId: 'ws-1',
      runId: 'run-1',
      input: 'help\n'
    };
    const stopPayload = {
      workspaceId: 'ws-1',
      runId: 'run-1'
    };

    await bridge.graph.loadGraphSnapshot(graphLoadPayload);
    await bridge.graph.saveGraphSnapshot(graphSavePayload);
    await bridge.components.listComponents(listPayload);
    await bridge.components.installComponent(installPayload);
    await bridge.components.uninstallComponent(uninstallPayload);
    await bridge.runs.inputRun(inputPayload);
    await bridge.runs.stopRun(stopPayload);

    expect(invoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.graphLoad, graphLoadPayload);
    expect(invoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.graphSave, graphSavePayload);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC_CHANNELS.componentList, listPayload);
    expect(invoke).toHaveBeenNthCalledWith(4, IPC_CHANNELS.componentInstall, installPayload);
    expect(invoke).toHaveBeenNthCalledWith(5, IPC_CHANNELS.componentUninstall, uninstallPayload);
    expect(invoke).toHaveBeenNthCalledWith(6, IPC_CHANNELS.runInput, inputPayload);
    expect(invoke).toHaveBeenNthCalledWith(7, IPC_CHANNELS.runStop, stopPayload);
  });
});
