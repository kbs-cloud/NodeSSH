import { contextBridge, ipcRenderer } from 'electron';

export interface FileDragInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  profileId?: string;
  token?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  startDrag: (fileInfo: FileDragInfo) => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  openExternal: (url: string) => void;
  showItemInFolder: (fullPath: string) => void;
}

const electronAPI: ElectronAPI = {
  isElectron: true,
  startDrag: (fileInfo: FileDragInfo) => {
    ipcRenderer.send('sftp:start-drag', fileInfo);
  },
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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
