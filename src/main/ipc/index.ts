import { BrowserWindow, ipcMain, shell, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  openSFTPSession,
  sftpDownloadFileDirect,
  sftpDownloadDirectoryDirect,
} from '../server/ssh/sftp-service';

export interface IpcOptions {
  getServerUrl?: () => string;
}

export const activeDownloadItems = new Map<string, Electron.DownloadItem>();
export const activeDirectTransfers = new Map<string, { abort: () => void; session?: any }>();

/**
 * Registers all IPC handlers for the main Electron process
 */
export function registerIpcHandlers(options: IpcOptions = {}): void {
  // 1. Window Control Handlers
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });

  // 2. Shell Open Handlers
  ipcMain.on('shell:open-external', (_event, urlToOpen: string) => {
    if (
      urlToOpen &&
      (urlToOpen.startsWith('http://') ||
        urlToOpen.startsWith('https://') ||
        urlToOpen.startsWith('mailto:'))
    ) {
      shell.openExternal(urlToOpen).catch((err) => {
        console.error('[IPC] Failed to open external URL:', err);
      });
    }
  });

  ipcMain.on('shell:show-item', (_event, fullPath: string) => {
    if (fullPath && fs.existsSync(fullPath)) {
      shell.showItemInFolder(fullPath);
    }
  });

  // 3. DevTools Handlers
  ipcMain.on('devtools:toggle', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  ipcMain.on('devtools:open', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents.openDevTools({ mode: 'detach' });
  });

  // 4. Download Cancellation Handler
  ipcMain.on('download:cancel', (_event, transferId: string) => {
    if (transferId) {
      const item = activeDownloadItems.get(transferId);
      if (item) {
        try {
          item.cancel();
        } catch {}
        activeDownloadItems.delete(transferId);
      }
      const direct = activeDirectTransfers.get(transferId);
      if (direct) {
        try {
          direct.abort();
        } catch {}
        activeDirectTransfers.delete(transferId);
      }
    }
  });

  // 5. Native Directory Selection Dialog
  ipcMain.handle('sftp:select-directory', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win || (BrowserWindow.getFocusedWindow() as any), {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Destination Folder to Download',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 6. Direct SFTP File/Folder Download (No Zip Compression, One File at a Time)
  ipcMain.handle(
    'sftp:download-direct',
    async (
      event,
      params: {
        remotePath: string;
        localDestDir?: string;
        isDirectory: boolean;
        transferId: string;
        profileTarget?: any;
      }
    ) => {
      const { remotePath, isDirectory, transferId, profileTarget } = params;
      const cleanPath = (remotePath || '').replace(/\\/g, '/');
      const safeName = path.posix.basename(cleanPath) || (isDirectory ? 'folder' : 'file');
      
      let localDestDir = params.localDestDir;
      if (!localDestDir) {
        try {
          localDestDir = app.getPath('downloads');
        } catch {
          localDestDir = os.homedir();
        }
      }

      const fullLocalTarget = isDirectory
        ? path.join(localDestDir, safeName)
        : path.join(localDestDir, safeName);

      const abortController = new AbortController();
      let sftpContext: any = null;

      const cleanup = () => {
        activeDirectTransfers.delete(transferId);
        if (sftpContext) {
          try {
            sftpContext.close();
          } catch {}
          sftpContext = null;
        }
      };

      activeDirectTransfers.set(transferId, {
        abort: () => {
          abortController.abort();
          cleanup();
        },
      });

      event.sender.send('download:started', {
        transferId,
        filename: safeName,
        totalBytes: 0,
        isFolder: isDirectory,
        direct: true,
      });

      try {
        const sshOptions = {
          userId: 'usr-default',
          profileId: typeof profileTarget === 'string' ? profileTarget : profileTarget?.id,
          host: typeof profileTarget === 'object' ? profileTarget?.host : undefined,
          port: typeof profileTarget === 'object' ? (profileTarget?.port ? Number(profileTarget.port) : undefined) : undefined,
          username: typeof profileTarget === 'object' ? profileTarget?.username : undefined,
          password: typeof profileTarget === 'object' ? profileTarget?.password : undefined,
          keyId: typeof profileTarget === 'object' ? profileTarget?.keyId : undefined,
          jumpHostId: typeof profileTarget === 'object' ? profileTarget?.jumpHostId : undefined,
          sftpCommand: typeof profileTarget === 'object' ? profileTarget?.sftpCommand : undefined,
        };

        sftpContext = await openSFTPSession(sshOptions);
        if (activeDirectTransfers.has(transferId)) {
          activeDirectTransfers.get(transferId)!.session = sftpContext;
        }

        if (isDirectory) {
          await sftpDownloadDirectoryDirect(sftpContext.sftp, remotePath, fullLocalTarget, {
            signal: abortController.signal,
            onProgress: (prog) => {
              event.sender.send('download:progress', {
                transferId,
                filename: safeName,
                currentFile: prog.currentFile,
                exploredFiles: prog.exploredFiles,
                exploredDirs: prog.exploredDirs,
                processedFiles: prog.processedFiles,
                receivedBytes: prog.processedBytes,
                totalBytes: prog.totalDiscoveredBytes,
                percent: prog.percent,
                isFolder: true,
                direct: true,
              });
            },
          });
        } else {
          await sftpDownloadFileDirect(sftpContext.sftp, remotePath, fullLocalTarget, {
            signal: abortController.signal,
            onProgress: (prog) => {
              event.sender.send('download:progress', {
                transferId,
                filename: safeName,
                currentFile: prog.currentFile,
                exploredFiles: 1,
                exploredDirs: 0,
                processedFiles: prog.processedFiles,
                receivedBytes: prog.processedBytes,
                totalBytes: prog.totalDiscoveredBytes,
                percent: prog.percent,
                isFolder: false,
                direct: true,
              });
            },
          });
        }

        event.sender.send('download:completed', {
          transferId,
          filename: safeName,
          savePath: fullLocalTarget,
          wasExtracted: false,
          direct: true,
        });

        cleanup();
        return { success: true, savePath: fullLocalTarget };
      } catch (err: any) {
        cleanup();
        if (abortController.signal.aborted || err.message === 'Transfer aborted') {
          event.sender.send('download:cancelled', { transferId, filename: safeName });
          return { success: false, aborted: true };
        }
        event.sender.send('download:failed', { transferId, filename: safeName, error: err.message });
        throw err;
      }
    }
  );

  ipcMain.on('sftp:cancel-direct-transfer', (_event, transferId: string) => {
    if (transferId) {
      const direct = activeDirectTransfers.get(transferId);
      if (direct) {
        try {
          direct.abort();
        } catch {}
        activeDirectTransfers.delete(transferId);
      }
    }
  });

}
