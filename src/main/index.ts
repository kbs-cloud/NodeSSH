import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { startServer, stopServer } from './server';
import { registerIpcHandlers } from './ipc';

app.name = 'NodeSSH';
app.setName('NodeSSH');

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
