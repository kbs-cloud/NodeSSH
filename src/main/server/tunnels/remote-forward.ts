import net from 'net';
import { Tunnel, TunnelRuntimeMetrics } from '../types';
import { SSHConnectionResult } from '../ssh/connection';
import { ActiveTunnelInstance } from './types';

export function createRemoteForwardTunnel(
  tunnel: Tunnel,
  sshConn: SSHConnectionResult
): Promise<ActiveTunnelInstance> {
  return new Promise((resolve, reject) => {
    const activeSockets = new Set<net.Socket>();
    let bytesSent = 0;
    let bytesReceived = 0;
    let startedAt: Date | null = new Date();
    let status: 'active' | 'stopped' | 'error' = 'active';
    let errorMessage: string | null = null;

    const bindHost = tunnel.bind_host || '127.0.0.1';
    const bindPort = tunnel.bind_port;
    const destHost = tunnel.dest_host || '127.0.0.1';
    const destPort = tunnel.dest_port || 80;

    sshConn.client.forwardIn(bindHost, bindPort, (err) => {
      if (err) {
        status = 'error';
        errorMessage = `Remote forward failed on remote port ${bindPort}: ${err.message}`;
        return reject(new Error(errorMessage));
      }

      sshConn.client.on('tcp connection', (info, accept, rejectConn) => {
        // Match port if multiple forwardIns exist
        if (info.destPort !== bindPort) {
          return;
        }

        const remoteStream = accept();
        const localSocket = net.connect(destPort, destHost, () => {
          activeSockets.add(localSocket);

          localSocket.on('data', (chunk) => {
            bytesSent += chunk.length;
          });

          remoteStream.on('data', (chunk: Buffer) => {
            bytesReceived += chunk.length;
          });

          localSocket.pipe(remoteStream);
          remoteStream.pipe(localSocket);

          const cleanup = () => {
            activeSockets.delete(localSocket);
            try {
              localSocket.destroy();
            } catch {
              // Ignore
            }
            try {
              remoteStream.end();
            } catch {
              // Ignore
            }
          };

          localSocket.on('close', cleanup);
          localSocket.on('error', cleanup);
          remoteStream.on('close', cleanup);
          remoteStream.on('error', cleanup);
        });

        localSocket.on('error', () => {
          try {
            remoteStream.end();
          } catch {
            // Ignore
          }
        });
      });

      const instance: ActiveTunnelInstance = {
        tunnel,
        status,
        startedAt,
        errorMessage,
        server: null,
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

          try {
            sshConn.client.unforwardIn(bindHost, bindPort, () => {});
          } catch {
            // Ignore
          }

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

      resolve(instance);
    });
  });
}
