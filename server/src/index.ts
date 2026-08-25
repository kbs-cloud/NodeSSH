import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import url from 'url';

import { config } from './config';
import { getDb, closeDb } from './db';
import { tunnelManager } from './tunnels/tunnel-manager';

import authRouter from './routes/auth';
import profilesRouter from './routes/profiles';
import keysRouter from './routes/keys';
import tunnelsRouter from './routes/tunnels';
import snippetsRouter from './routes/snippets';
import sftpRouter from './routes/sftp';
import systemRouter from './routes/system';

import { setupTerminalWebSocket } from './ws/terminal-ws';
import { setupSftpWebSocket } from './ws/sftp-ws';

const app = express();
const server = http.createServer(app);

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

// Initialize SQLite database
getDb();

// Register REST API routes
app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/keys', keysRouter);
app.use('/api/tunnels', tunnelsRouter);
app.use('/api/snippets', snippetsRouter);
app.use('/api/sftp', sftpRouter);
app.use('/api/system', systemRouter);

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

// WebSocket Servers
const terminalWss = new WebSocketServer({ noServer: true });
const sftpWss = new WebSocketServer({ noServer: true });

setupTerminalWebSocket(terminalWss);
setupSftpWebSocket(sftpWss);

// Handle HTTP upgrade to WebSockets
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url || '').pathname;

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

// Start HTTP and WebSocket server
server.listen(config.port, config.host, async () => {
  console.log('====================================================');
  console.log(`  🚀 NodeSSH Backend Server running on http://${config.host}:${config.port}`);
  console.log(`  📁 SQLite Database: ${config.dbPath}`);
  console.log(`  🔐 Key Vault & AES-256-GCM Encryption: Ready`);
  console.log(`  🌐 SSH Tunnel Engine & SOCKS5 Proxy: Ready`);
  console.log(`  ⚡ WebSocket Terminal (/ws/terminal) & SFTP: Ready`);
  console.log('====================================================');

  // Start any configured auto-start tunnels
  await tunnelManager.initAutoStartTunnels();
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('\n[NodeSSH] Shutting down gracefully...');
  await tunnelManager.stopAll();
  closeDb();
  server.close(() => {
    console.log('[NodeSSH] Server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[NodeSSH] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export { app, server };
