import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import url from 'url';

import { config, ServerConfigOptions } from './config';
import { getDb, closeDb } from './db';
import { tunnelManager } from './tunnels/tunnel-manager';

import authRouter from './routes/auth';
import profilesRouter from './routes/profiles';
import keysRouter from './routes/keys';
import tunnelsRouter from './routes/tunnels';
import snippetsRouter from './routes/snippets';
import sftpRouter from './routes/sftp';
import systemRouter from './routes/system';
import localFilesRouter from './routes/local-files';

import { setupTerminalWebSocket } from './ws/terminal-ws';
import { setupSftpWebSocket } from './ws/sftp-ws';

export interface ServerOptions {
  port?: number;
  host?: string;
  userDataPath?: string;
  clientDistPath?: string;
}

export interface ServerInstance {
  port: number;
  server: http.Server;
  app: express.Express;
}

let activeApp: express.Express | null = null;
let activeServer: http.Server | null = null;
let activeTerminalWss: WebSocketServer | null = null;
let activeSftpWss: WebSocketServer | null = null;
let isStarting = false;

/**
 * Creates and initializes the Express application
 */
function createApp(): express.Express {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Register REST API routes
  app.use('/api/auth', authRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/keys', keysRouter);
  app.use('/api/tunnels', tunnelsRouter);
  app.use('/api/snippets', snippetsRouter);
  app.use('/api/sftp', sftpRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/local-files', localFilesRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
  });

  // Serve frontend static assets if client build exists
  const clientDist = config.clientDistPath;
  if (fs.existsSync(clientDist)) {
    console.log(`[NodeSSH] Serving static client build from: ${clientDist}`);
    app.use(express.static(clientDist));

    // SPA fallback for all non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        name: 'NodeSSH API Server',
        status: 'running',
        endpoints: {
          auth: '/api/auth',
          profiles: '/api/profiles',
          keys: '/api/keys',
          tunnels: '/api/tunnels',
          snippets: '/api/snippets',
          sftp: '/api/sftp',
          system: '/api/system',
          terminalWs: '/ws/terminal',
          sftpWs: '/ws/sftp',
        },
      });
    });
  }

  return app;
}

/**
 * Starts the in-process NodeSSH Express and WebSocket server
 */
export async function startServer(options: ServerOptions = {}): Promise<ServerInstance> {
  if (activeServer && activeApp) {
    const addr = activeServer.address();
    const currentPort = typeof addr === 'object' && addr ? addr.port : config.port;
    return {
      port: currentPort,
      server: activeServer,
      app: activeApp,
    };
  }

  if (isStarting) {
    // Wait for in-flight startup
    while (isStarting) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (activeServer && activeApp) {
      const addr = activeServer.address();
      const currentPort = typeof addr === 'object' && addr ? addr.port : config.port;
      return { port: currentPort, server: activeServer, app: activeApp };
    }
  }

  isStarting = true;

  try {
    // Apply configuration options
    config.init(options as ServerConfigOptions);

    // Initialize SQLite database
    getDb();

    // Create Express App
    const app = createApp();
    const server = http.createServer(app);

    // WebSocket Servers
    const terminalWss = new WebSocketServer({ noServer: true });
    const sftpWss = new WebSocketServer({ noServer: true });

    setupTerminalWebSocket(terminalWss);
    setupSftpWebSocket(sftpWss);

    // Handle HTTP upgrade to WebSockets
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', 'http://127.0.0.1').pathname;

      if (pathname === '/ws/terminal' || pathname === '/ws') {
        terminalWss.handleUpgrade(request, socket, head, (ws) => {
          terminalWss.emit('connection', ws, request);
        });
      } else if (pathname === '/ws/sftp') {
        sftpWss.handleUpgrade(request, socket, head, (ws) => {
          sftpWss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Start listening on configured host and port
    const actualPort = await new Promise<number>((resolve, reject) => {
      server.once('error', (err) => {
        reject(err);
      });

      server.listen(config.port, config.host, async () => {
        const addr = server.address();
        const listeningPort = typeof addr === 'object' && addr ? addr.port : config.port;
        config.port = listeningPort;

        console.log('====================================================');
        console.log(`  🚀 NodeSSH In-Process Server running on http://${config.host}:${listeningPort}`);
        console.log(`  📁 SQLite Database: ${config.dbPath}`);
        console.log(`  🔐 Key Vault & AES-256-GCM Encryption: Ready`);
        console.log(`  🌐 SSH Tunnel Engine & SOCKS5 Proxy: Ready`);
        console.log(`  ⚡ WebSocket Terminal (/ws/terminal) & SFTP: Ready`);
        console.log('====================================================');

        // Start any configured auto-start tunnels
        try {
          await tunnelManager.initAutoStartTunnels();
        } catch (err: any) {
          console.error('[NodeSSH] Error starting auto tunnels:', err.message);
        }

        resolve(listeningPort);
      });
    });

    activeApp = app;
    activeServer = server;
    activeTerminalWss = terminalWss;
    activeSftpWss = sftpWss;

    return {
      port: actualPort,
      server,
      app,
    };
  } finally {
    isStarting = false;
  }
}

/**
 * Stops the in-process server and shuts down all active resources cleanly
 */
export async function stopServer(): Promise<void> {
  console.log('[NodeSSH] Stopping in-process server...');

  try {
    await tunnelManager.stopAll();
  } catch (err: any) {
    console.error('[NodeSSH] Error stopping tunnels:', err.message);
  }

  if (activeTerminalWss) {
    try {
      for (const client of activeTerminalWss.clients) {
        try {
          client.close();
        } catch {}
      }
      activeTerminalWss.close();
    } catch {}
    activeTerminalWss = null;
  }

  if (activeSftpWss) {
    try {
      for (const client of activeSftpWss.clients) {
        try {
          client.close();
        } catch {}
      }
      activeSftpWss.close();
    } catch {}
    activeSftpWss = null;
  }

  closeDb();

  if (activeServer) {
    try {
      (activeServer as any).closeAllConnections?.();
      (activeServer as any).closeIdleConnections?.();
    } catch {}
    await new Promise<void>((resolve) => {
      activeServer!.close(() => {
        resolve();
      });
    });
    activeServer = null;
    activeApp = null;
  }

  console.log('[NodeSSH] In-process server stopped.');
}

// Fallback direct invocation support (tsx / node)
if (require.main === module) {
  const isTestMode = process.env.NODE_ENV === 'test' || process.argv.some((a) => a.includes('test'));
  if (!isTestMode) {
    startServer().catch((err) => {
      console.error('[NodeSSH] Server startup error:', err);
      process.exit(1);
    });

    const gracefulShutdown = async () => {
      console.log('\n[NodeSSH] Shutting down gracefully...');
      await stopServer();
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }
}

export { activeApp as app, activeServer as server };
