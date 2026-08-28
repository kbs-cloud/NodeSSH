import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { startServer, stopServer } from './server';
import { registerIpcHandlers, activeDownloadItems } from './ipc';

app.name = 'NodeSSH';
app.setName('NodeSSH');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('no-crash-upload');

let mainWindow: BrowserWindow | null = null;
let serverPort = 3001;
let isShuttingDown = false;

const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

/**
 * Checks if the Vite dev server is responding
 */
function isViteDevRunning(urlStr: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = http.get(
        {
          hostname: u.hostname,
          port: u.port || 5173,
          path: '/',
          timeout: 300,
        },
        (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 304);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Resolves the path to the preload script
 */
function getPreloadPath(): string {
  const candidates = [
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../../dist/preload/index.js'),
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, '../preload.js'),
    path.resolve(app.getAppPath(), 'dist/preload/index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to standard build location
  return path.join(__dirname, '../preload/index.js');
}

/**
 * Creates the main application window
 */
function createMainWindow(): BrowserWindow {
  const preloadPath = getPreloadPath();
  const serverUrl = `http://127.0.0.1:${serverPort}`;

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'NodeSSH',
    backgroundColor: '#070913',
    frame: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Enable Developer Tools shortcuts (F12, Ctrl+Shift+I, Cmd+Option+I)
  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F12' ||
      ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')
    ) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
      event.preventDefault();
    }
  });

  // Determine whether to connect to Vite dev server or load in-process server URL
  isViteDevRunning(VITE_DEV_URL).then((viteRunning) => {
    if (win.isDestroyed()) return;
    if (viteRunning) {
      console.log(`[Electron] Connecting to Vite dev server at ${VITE_DEV_URL}`);
      win.loadURL(VITE_DEV_URL);
    } else {
      console.log(`[Electron] Loading in-process server UI at ${serverUrl}`);
      win.loadURL(serverUrl);
    }
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

/**
 * Graceful cleanup of server, tunnels, and resources
 */
async function cleanup(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[Electron] Cleaning up server and tunnels...');
  try {
    await stopServer();
  } catch (err: any) {
    console.error('[Electron] Error during stopServer:', err.message);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    const configuredPort = parseInt(process.env.PORT || '3001', 10);
    const userDataPath = app.getPath('userData');

    // Start in-process backend server
    const serverInstance = await startServer({
      host: '127.0.0.1',
      port: configuredPort,
      userDataPath,
    });
    serverPort = serverInstance.port;

    // Register all IPC handlers
    registerIpcHandlers({
      getServerUrl: () => `http://127.0.0.1:${serverPort}`,
    });

    // Handle native Chromium downloads (e.g. drag-to-desktop or browser downloads)
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const filename = item.getFilename();
      const totalBytes = item.getTotalBytes();
      const downloadUrl = item.getURL();
      let transferId = `dl-${Date.now()}`;
      try {
        const parsed = new URL(downloadUrl, `http://127.0.0.1:${serverPort}`);
        const qId = parsed.searchParams.get('transferId');
        if (qId) transferId = qId;
      } catch {}

      const isFolder = filename.toLowerCase().endsWith('.zip');

      activeDownloadItems.set(transferId, item);

      webContents.send('download:started', {
        transferId,
        filename,
        totalBytes,
        isFolder,
      });

      item.on('updated', (_updateEvent, state) => {
        if (state === 'progressing') {
          const receivedBytes = item.getReceivedBytes();
          const total = item.getTotalBytes();
          const percent = total > 0 ? Math.min(99, Math.round((receivedBytes / total) * 100)) : 0;
          webContents.send('download:progress', {
            transferId,
            filename,
            receivedBytes,
            totalBytes: total,
            percent,
            isFolder,
          });
        } else if (state === 'interrupted') {
          webContents.send('download:interrupted', {
            transferId,
            filename,
          });
        }
      });

      item.once('done', async (_doneEvent, state) => {
        activeDownloadItems.delete(transferId);
        if (state === 'completed') {
          let finalPath = item.getSavePath();
          let wasExtracted = false;

          let dropTarget: string | null = null;
          try {
            const { resolveDropTargetDirectory, getFallbackDirectory } = require('./ipc/drop-target-resolver');
            dropTarget = await resolveDropTargetDirectory();
            if (!dropTarget || !fs.existsSync(dropTarget)) {
              dropTarget = getFallbackDirectory();
            }
          } catch {}

          if (isFolder && finalPath && fs.existsSync(finalPath)) {
            try {
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(finalPath);
              const folderName = path.basename(finalPath, '.zip');

              // Target destination directory: inside the user's active Explorer window or Desktop
              const destDir = (dropTarget && fs.existsSync(dropTarget))
                ? path.join(dropTarget, folderName)
                : path.join(path.dirname(finalPath), folderName);

              if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
              }
              zip.extractAllTo(destDir, true);
              try {
                fs.unlinkSync(finalPath);
              } catch {}
              finalPath = destDir;
              wasExtracted = true;
              console.log(`[Electron] Successfully extracted folder to drop destination: ${destDir}`);
            } catch (err: any) {
              console.error('[Electron] Failed to auto-extract folder zip:', err.message);
            }
          } else if (!isFolder && finalPath && fs.existsSync(finalPath) && dropTarget && fs.existsSync(dropTarget)) {
            const targetFilePath = path.join(dropTarget, path.basename(finalPath));
            if (path.dirname(finalPath) !== dropTarget && !fs.existsSync(targetFilePath)) {
              try {
                fs.copyFileSync(finalPath, targetFilePath);
                try { fs.unlinkSync(finalPath); } catch {}
                finalPath = targetFilePath;
              } catch {}
            }
          }

          webContents.send('download:completed', {
            transferId,
            filename: wasExtracted ? path.basename(finalPath) : filename,
            savePath: finalPath,
            wasExtracted,
          });
        } else if (state === 'cancelled') {
          webContents.send('download:cancelled', {
            transferId,
            filename,
          });
        } else {
          webContents.send('download:failed', {
            transferId,
            filename,
            state,
          });
        }
      });
    });

    // Create the main window
    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  } catch (err: any) {
    console.error('[Electron] Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (e) => {
  if (!isShuttingDown) {
    e.preventDefault();
    await cleanup();
    app.quit();
  }
});

app.on('will-quit', async () => {
  await cleanup();
});
