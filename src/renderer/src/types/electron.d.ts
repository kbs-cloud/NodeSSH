export interface ElectronAPI {
  isElectron?: boolean;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  openExternal: (url: string) => void;
  showItemInFolder: (path: string) => void;
  toggleDevTools?: () => void;
  openDevTools?: () => void;
  cancelDownload?: (transferId: string) => void;
  selectDownloadDirectory?: () => Promise<string | null>;
  downloadDirect?: (params: any) => Promise<any>;
  cancelDirectDownload?: (transferId: string) => void;
  onDownloadStarted?: (callback: (data: any) => void) => () => void;
  onDownloadProgress?: (callback: (data: any) => void) => () => void;
  onDownloadCompleted?: (callback: (data: any) => void) => () => void;
  onDownloadCancelled?: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
