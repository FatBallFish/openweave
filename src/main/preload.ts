import { contextBridge } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc/contracts';

const detectPlatform = (): string => {
  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) {
      return 'darwin';
    }
    if (ua.includes('win')) {
      return 'win32';
    }
    if (ua.includes('linux')) {
      return 'linux';
    }
  }
  return 'unknown';
};

contextBridge.exposeInMainWorld('openweaveShell', {
  platform: detectPlatform(),
  ipcChannels: IPC_CHANNELS
});
