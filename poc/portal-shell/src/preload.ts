import { contextBridge, ipcRenderer } from 'electron';
import type { PortalBounds, PortalHarnessSnapshot } from './shared/portal-contract';

type SnapshotListener = (snapshot: PortalHarnessSnapshot) => void;

contextBridge.exposeInMainWorld('portalHarness', {
  bootstrap: () => ipcRenderer.invoke('portal:bootstrap') as Promise<PortalHarnessSnapshot>,
  activatePortal: (portalId: string) => ipcRenderer.invoke('portal:activate', portalId) as Promise<PortalHarnessSnapshot>,
  setZoom: (zoom: number) => ipcRenderer.invoke('portal:set-zoom', zoom) as Promise<PortalHarnessSnapshot>,
  syncPortalBounds: (portalId: string, bounds: PortalBounds) =>
    ipcRenderer.invoke('portal:sync-bounds', { portalId, bounds }) as Promise<PortalHarnessSnapshot>,
  subscribe: (listener: SnapshotListener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: PortalHarnessSnapshot) => {
      listener(snapshot);
    };

    ipcRenderer.on('portal:snapshot', wrapped);
    return () => {
      ipcRenderer.removeListener('portal:snapshot', wrapped);
    };
  },
});
