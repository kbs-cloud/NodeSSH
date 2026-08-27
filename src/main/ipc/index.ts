import { BrowserWindow, ipcMain, shell, nativeImage, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';

export interface FileDragInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  profileId?: string;
  token?: string;
}

export interface IpcOptions {
  getServerUrl?: () => string;
}

// 1x1 transparent standard PNG icon for native drag-and-drop
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAAElFTkSuQmCC';

/**
 * Ensures the drag staging temporary folder and icon file exist.
 */
function getStagingDir(): { stagingDir: string; icon: any; iconPath: string } {
  let tempBase: string;
  try {
    tempBase = app?.getPath('temp') || os.tmpdir();
  } catch {
    tempBase = os.tmpdir();
  }

  const stagingDir = path.join(tempBase, 'nodessh-drag');
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  const iconPath = path.join(stagingDir, 'drag-icon.png');
  const pngBuffer = Buffer.from(VALID_PNG_BASE64, 'base64');
  try {
    if (!fs.existsSync(iconPath)) {
      fs.writeFileSync(iconPath, pngBuffer);
    }
  } catch (err) {
    console.error('[IPC] Failed to write drag icon:', err);
  }

  const icon = nativeImage.createFromBuffer(pngBuffer);
  return { stagingDir, icon, iconPath };
}

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

  // 3. SFTP Native Drag-and-Drop Handler
  ipcMain.on('sftp:start-drag', async (event, fileInfo: FileDragInfo) => {
    try {
      const { stagingDir, icon, iconPath } = getStagingDir();
      const cleanPath = (fileInfo.path || '').replace(/\\/g, '/');
      const safeName = fileInfo.name || path.posix.basename(cleanPath) || 'file';

      const serverUrl = options.getServerUrl ? options.getServerUrl() : 'http://127.0.0.1:3001';

      const q = new URLSearchParams({ path: fileInfo.path });
      if (fileInfo.profileId) {
        q.set('profileId', fileInfo.profileId);
      }
      if (fileInfo.token) {
        q.set('token', fileInfo.token);
      }

      const downloadUrl = `${serverUrl}/api/sftp/download?${q.toString()}`;
      console.log(`[IPC] Starting drag staging for ${fileInfo.path} from ${downloadUrl}`);

      const headers: Record<string, string> = {};
      if (fileInfo.token) {
        headers['Authorization'] = `Bearer ${fileInfo.token}`;
      }

      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error(
          `[IPC] Failed to fetch SFTP item for drag: ${response.status} ${response.statusText} — ${errBody}`
        );
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (fileInfo.isDirectory) {
        // It's a directory (backend returns zip)
        const tempZipPath = path.join(stagingDir, `${safeName}.zip`);
        const targetDir = path.join(stagingDir, safeName);

        // Clean previous extraction if exists
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });

        // Write and extract ZIP
        fs.writeFileSync(tempZipPath, buffer);
        try {
          const zip = new AdmZip(tempZipPath);
          zip.extractAllTo(targetDir, true);
        } finally {
          try {
            fs.unlinkSync(tempZipPath);
          } catch {}
        }

        console.log(`[IPC] Triggering native drag for directory: ${targetDir}`);
        event.sender.startDrag({
          file: targetDir,
          icon: icon || iconPath,
        });
      } else {
        // It's a single file
        const targetFilePath = path.join(stagingDir, safeName);
        fs.writeFileSync(targetFilePath, buffer);

        console.log(`[IPC] Triggering native drag for file: ${targetFilePath}`);
        event.sender.startDrag({
          file: targetFilePath,
          icon: icon || iconPath,
        });
      }
    } catch (err) {
      console.error('[IPC] Error during sftp:start-drag:', err);
    }
  });
}
