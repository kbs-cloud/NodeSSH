export interface ElectronDragFileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  profileId?: string;
}

export interface ElectronAPI {
  isElectron?: boolean;
  startDrag: (fileInfo: { path: string; name: string; isDirectory: boolean; profileId?: string }) => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  openExternal: (url: string) => void;
  showItemInFolder: (path: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
