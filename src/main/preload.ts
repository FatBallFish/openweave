import { contextBridge } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc/contracts';

contextBridge.exposeInMainWorld('openweaveShell', {
  platform: process.platform,
  ipcChannels: IPC_CHANNELS
});
