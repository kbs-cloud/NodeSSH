import net from 'net';
import { Tunnel, TunnelRuntimeMetrics } from '../types';
import { ActiveTunnelInstance } from './types';

/**
 * Creates a high-performance direct TCP Proxy / Relay instance in Node.js.
 * Directly forwards incoming local TCP connections to the destination host & port
 * without requiring an intermediary SSH hop.
 */
export function createDirectTcpProxy(tunnel: Tunnel): ActiveTunnelInstance {
  const activeSockets = new Set<net.Socket>();
  let bytesSent = 0;
  let bytesReceived = 0;
  let startedAt: Date | null = new Date();
  let status: 'active' | 'stopped' | 'error' = 'active';
  let errorMessage: string | null = null;

  const destHost = tunnel.dest_host || '127.0.0.1';
  const destPort = tunnel.dest_port || 22;
  const bindHost = tunnel.bind_host || '127.0.0.1';
  const bindPort = tunnel.bind_port;

  const server = net.createServer((clientSocket) => {
    activeSockets.add(clientSocket);

    const remoteSocket = net.connect(destPort, destHost, () => {
      // Pipe client <-> remoteSocket
      clientSocket.pipe(remoteSocket);
      remoteSocket.pipe(clientSocket);
    });

    clientSocket.on('data', (chunk) => {
      bytesSent += chunk.length;
    });

    remoteSocket.on('data', (chunk) => {
      bytesReceived += chunk.length;
    });

    const cleanup = () => {
      activeSockets.delete(clientSocket);
      try {
        clientSocket.destroy();
      } catch {}
      try {
        remoteSocket.destroy();
      } catch {}
    };

    clientSocket.on('close', cleanup);
    clientSocket.on('error', cleanup);
    remoteSocket.on('close', cleanup);
    remoteSocket.on('error', cleanup);
  });

  server.on('error', (err: any) => {
    status = 'error';
    errorMessage = `TCP Proxy error on ${bindHost}:${bindPort} -> ${destHost}:${destPort}: ${err.message}`;
  });

  server.listen(bindPort, bindHost, () => {
    status = 'active';
    errorMessage = null;
  });

  const instance: ActiveTunnelInstance = {
    tunnel,
    status,
    startedAt,
    errorMessage,
    server,
    activeSockets,
    get bytesSent() {
      return bytesSent;
    },
    set bytesSent(v) {
      bytesSent = v;
    },
    get bytesReceived() {
      return bytesReceived;
    },
    set bytesReceived(v) {
      bytesReceived = v;
    },
    getMetrics(): TunnelRuntimeMetrics {
      const now = Date.now();
      const uptime = startedAt ? Math.floor((now - startedAt.getTime()) / 1000) : 0;
      return {
        activeConnections: activeSockets.size,
        bytesSent,
        bytesReceived,
        uptimeSeconds: uptime,
        status,
        errorMessage,
        startedAt: startedAt ? startedAt.toISOString() : null,
      };
    },
    async stop(): Promise<void> {
      status = 'stopped';
      for (const socket of activeSockets) {
        try {
          socket.destroy();
        } catch {}
      }
      activeSockets.clear();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };

  return instance;
}
