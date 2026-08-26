import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import AdmZip from 'adm-zip';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 3001;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// 100% valid standard PNG icon (1x1 transparent) for native drag-and-drop
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAAElFTkSuQmCC';

/**
 * Ensures the drag temporary folder and icon file exist.
 */
function getStagingDir(): { stagingDir: string; icon: any; iconPath: string } {
  const stagingDir = path.join(os.tmpdir(), 'nodessh-drag');
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  const iconPath = path.join(stagingDir, 'drag-icon.png');
  const pngBuffer = Buffer.from(VALID_PNG_BASE64, 'base64');
  try {
    fs.writeFileSync(iconPath, pngBuffer);
  } catch (err) {
    console.error('[Electron] Failed to write drag icon:', err);
  }

  const icon = nativeImage.createFromBuffer(pngBuffer);
  return { stagingDir, icon, iconPath };
}

/**
 * Checks if the backend server is responding on /api/health
 */
function isServerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/health`, { timeout: 1000 }, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Waits for backend server to be healthy with timeout
 */
async function waitForServer(maxAttempts = 30, intervalMs = 300): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await isServerReady();
    if (ready) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Spawns the embedded backend server if not running
 */
async function ensureBackendServer(): Promise<void> {
  const alreadyRunning = await isServerReady();
  if (alreadyRunning) {
    console.log('[Electron] Backend server is already running.');
    return;
  }

  const appRoot = path.resolve(__dirname, '..', '..');
  const serverDist = path.join(appRoot, 'server', 'dist', 'index.js');
  const serverSrc = path.join(appRoot, 'server', 'src', 'index.ts');

  const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  if (fs.existsSync(serverDist)) {
    serverProcess = spawn(nodeCmd, [serverDist], {
      cwd: path.join(appRoot, 'server'),
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'inherit',
      shell: true,
    });
  } else if (fs.existsSync(serverSrc)) {
    // In development fallback to npx tsx
    serverProcess = spawn(npxCmd, ['tsx', 'src/index.ts'], {
      cwd: path.join(appRoot, 'server'),
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'inherit',
      shell: true,
    });
  }

  if (serverProcess) {
    serverProcess.on('error', (err) => {
      console.error('[Electron] Failed to start backend server:', err);
    });
    serverProcess.on('exit', (code) => {
      console.log(`[Electron] Backend server process exited with code ${code}`);
    });
  }

  await waitForServer();
}

/**
 * Creates the main application window
 */
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'NodeSSH',
    backgroundColor: '#070913',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(VITE_DEV_URL).catch(() => {
      console.log(`[Electron] Could not load ${VITE_DEV_URL}, trying server URL ${SERVER_URL}`);
      win.loadURL(SERVER_URL);
    });
  } else {
    // In production, try loading static client dist file if exists, otherwise server URL
    const clientDistHtml = path.resolve(__dirname, '..', '..', 'client', 'dist', 'index.html');
    if (fs.existsSync(clientDistHtml)) {
      win.loadFile(clientDistHtml);
    } else {
      win.loadURL(SERVER_URL);
    }
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

/**
 * Register all IPC Handlers
 */
function registerIpcHandlers(): void {
  // Window control handlers
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

  // Shell open handlers
  ipcMain.on('shell:open-external', (_event, urlToOpen: string) => {
    if (
      urlToOpen &&
      (urlToOpen.startsWith('http://') ||
        urlToOpen.startsWith('https://') ||
        urlToOpen.startsWith('mailto:'))
    ) {
      shell.openExternal(urlToOpen);
    }
  });

  ipcMain.on('shell:show-item', (_event, fullPath: string) => {
    if (fullPath && fs.existsSync(fullPath)) {
      shell.showItemInFolder(fullPath);
    }
  });

  // SFTP Native Drag-and-Drop Handler
  ipcMain.on(
    'sftp:start-drag',
    async (
      event,
      fileInfo: { path: string; name: string; isDirectory: boolean; profileId?: string; token?: string }
    ) => {
      try {
        const { stagingDir, icon, iconPath } = getStagingDir();
        const cleanPath = (fileInfo.path || '').replace(/\\/g, '/');
        const safeName = fileInfo.name || path.posix.basename(cleanPath) || 'file';

        const q = new URLSearchParams({ path: fileInfo.path });
        if (fileInfo.profileId) {
          q.set('profileId', fileInfo.profileId);
        }
        if (fileInfo.token) {
          q.set('token', fileInfo.token);
        }

        const downloadUrl = `${SERVER_URL}/api/sftp/download?${q.toString()}`;
        console.log(`[Electron] Starting drag staging for ${fileInfo.path} from ${downloadUrl}`);

        const headers: Record<string, string> = {};
        if (fileInfo.token) {
          headers['Authorization'] = `Bearer ${fileInfo.token}`;
        }

        const response = await fetch(downloadUrl, { headers });
        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.error(
            `[Electron] Failed to fetch SFTP item for drag: ${response.status} ${response.statusText} — ${errBody}`
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

          console.log(`[Electron] Triggering native drag for directory: ${targetDir}`);
          event.sender.startDrag({
            file: targetDir,
            icon: icon || iconPath,
          });
        } else {
          // It's a single file
          const targetFilePath = path.join(stagingDir, safeName);
          fs.writeFileSync(targetFilePath, buffer);

          console.log(`[Electron] Triggering native drag for file: ${targetFilePath}`);
          event.sender.startDrag({
            file: targetFilePath,
            icon: icon || iconPath,
          });
        }
      } catch (err) {
        console.error('[Electron] Error during sftp:start-drag:', err);
      }
    }
  );
}

// App lifecycle
app.whenReady().then(async () => {
  getStagingDir();
  registerIpcHandlers();
  await ensureBackendServer();
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch {}
    serverProcess = null;
  }
});
