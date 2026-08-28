import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  isElectron: boolean;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  openExternal: (url: string) => void;
  showItemInFolder: (fullPath: string) => void;
  toggleDevTools: () => void;
  openDevTools: () => void;
  cancelDownload: (transferId: string) => void;
  selectDownloadDirectory: () => Promise<string | null>;
  downloadDirect: (params: {
    remotePath: string;
    localDestDir?: string;
    isDirectory: boolean;
    transferId: string;
    profileTarget?: any;
  }) => Promise<any>;
  cancelDirectDownload: (transferId: string) => void;
  onDownloadStarted: (callback: (data: any) => void) => () => void;
  onDownloadProgress: (callback: (data: any) => void) => () => void;
  onDownloadCompleted: (callback: (data: any) => void) => () => void;
  onDownloadCancelled: (callback: (data: any) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  isElectron: true,
  minimize: () => {
    ipcRenderer.send('window:minimize');
  },
  maximize: () => {
    ipcRenderer.send('window:maximize');
  },
  close: () => {
    ipcRenderer.send('window:close');
  },
  isMaximized: () => {
    return ipcRenderer.invoke('window:is-maximized');
  },
  openExternal: (url: string) => {
    ipcRenderer.send('shell:open-external', url);
  },
  showItemInFolder: (fullPath: string) => {
    ipcRenderer.send('shell:show-item', fullPath);
  },
  toggleDevTools: () => {
    ipcRenderer.send('devtools:toggle');
  },
  openDevTools: () => {
    ipcRenderer.send('devtools:open');
  },
  cancelDownload: (transferId: string) => {
    ipcRenderer.send('download:cancel', transferId);
  },
  selectDownloadDirectory: () => {
    return ipcRenderer.invoke('sftp:select-directory');
  },
  downloadDirect: (params: any) => {
    return ipcRenderer.invoke('sftp:download-direct', params);
  },
  cancelDirectDownload: (transferId: string) => {
    ipcRenderer.send('sftp:cancel-direct-transfer', transferId);
  },
  onDownloadStarted: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('download:started', handler);
    return () => ipcRenderer.removeListener('download:started', handler);
  },
  onDownloadProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onDownloadCompleted: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('download:completed', handler);
    return () => ipcRenderer.removeListener('download:completed', handler);
  },
  onDownloadCancelled: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('download:cancelled', handler);
    return () => ipcRenderer.removeListener('download:cancelled', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
