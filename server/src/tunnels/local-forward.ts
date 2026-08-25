import net from 'net';
import { Tunnel, TunnelRuntimeMetrics } from '../types';
import { SSHConnectionResult } from '../ssh/connection';
import { ActiveTunnelInstance } from './types';

export function createLocalForwardTunnel(
  tunnel: Tunnel,
  sshConn: SSHConnectionResult
): ActiveTunnelInstance {
  const activeSockets = new Set<net.Socket>();
  let bytesSent = 0;
  let bytesReceived = 0;
  let startedAt: Date | null = new Date();
  let status: 'active' | 'stopped' | 'error' = 'active';
  let errorMessage: string | null = null;

  const destHost = tunnel.dest_host || '127.0.0.1';
  const destPort = tunnel.dest_port || 80;

  const server = net.createServer((clientSocket) => {
    activeSockets.add(clientSocket);

    const clientSrcIp = clientSocket.remoteAddress || '127.0.0.1';
    const clientSrcPort = clientSocket.remotePort || 0;

    sshConn.client.forwardOut(
      clientSrcIp,
      clientSrcPort,
      destHost,
      destPort,
      (err, stream) => {
        if (err) {
          clientSocket.destroy();
          return;
        }

        // Pipe client -> SSH stream (sent)
        clientSocket.on('data', (chunk) => {
          bytesSent += chunk.length;
        });

        // Pipe SSH stream -> client (received)
        stream.on('data', (chunk: Buffer) => {
          bytesReceived += chunk.length;
        });

        clientSocket.pipe(stream);
        stream.pipe(clientSocket);

        const cleanup = () => {
          activeSockets.delete(clientSocket);
          try {
            clientSocket.destroy();
          } catch {
            // Ignore
          }
          try {
            stream.end();
          } catch {
            // Ignore
          }
        };

        clientSocket.on('close', cleanup);
        clientSocket.on('error', cleanup);
        stream.on('close', cleanup);
        stream.on('error', cleanup);
      }
    );
  });

  server.on('error', (err: any) => {
    status = 'error';
    errorMessage = `Local forward error on ${tunnel.bind_host}:${tunnel.bind_port}: ${err.message}`;
  });

  const bindHost = tunnel.bind_host || '127.0.0.1';
  server.listen(tunnel.bind_port, bindHost);

  const instance: ActiveTunnelInstance = {
    tunnel,
    status,
    startedAt,
    errorMessage,
    server,
    sshClient: sshConn.client,
    jumpClient: sshConn.jumpClient,
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
    stop: async () => {
      status = 'stopped';
      for (const sock of activeSockets) {
        try {
          sock.destroy();
        } catch {
          // Ignore
        }
      }
      activeSockets.clear();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      try {
        sshConn.client.end();
      } catch {
        // Ignore
      }

      if (sshConn.jumpClient) {
        try {
          sshConn.jumpClient.end();
        } catch {
          // Ignore
        }
      }
    },
    getMetrics: (): TunnelRuntimeMetrics => {
      const uptime = startedAt && status === 'active'
        ? Math.floor((Date.now() - startedAt.getTime()) / 1000)
        : 0;

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
  };

  return instance;
}
