import { afterEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('preload bridge', () => {
  it('exposes the component bridge with the expected IPC channels and payloads', async () => {
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
    expect(bridge.ipcChannels.componentList).toBe(IPC_CHANNELS.componentList);
    expect(bridge.ipcChannels.componentInstall).toBe(IPC_CHANNELS.componentInstall);
    expect(bridge.ipcChannels.componentUninstall).toBe(IPC_CHANNELS.componentUninstall);

    const listPayload = {};
    const installPayload = {
      sourceType: 'directory',
      sourcePath: '/tmp/component-dir'
    };
    const uninstallPayload = { name: 'external.note', version: '1.0.0' };

    await bridge.components.listComponents(listPayload);
    await bridge.components.installComponent(installPayload);
    await bridge.components.uninstallComponent(uninstallPayload);

    expect(invoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.componentList, listPayload);
    expect(invoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.componentInstall, installPayload);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC_CHANNELS.componentUninstall, uninstallPayload);
  });
});
