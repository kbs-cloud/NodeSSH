import net from 'net';
import { Tunnel, TunnelRuntimeMetrics } from '../types';
import { SSHConnectionResult } from '../ssh/connection';
import { ActiveTunnelInstance } from './types';

export function createSocks5ProxyTunnel(
  tunnel: Tunnel,
  sshConn: SSHConnectionResult
): ActiveTunnelInstance {
  const activeSockets = new Set<net.Socket>();
  let bytesSent = 0;
  let bytesReceived = 0;
  let startedAt: Date | null = new Date();
  let status: 'active' | 'stopped' | 'error' = 'active';
  let errorMessage: string | null = null;

  const server = net.createServer((socket) => {
    activeSockets.add(socket);

    let state: 'HANDSHAKE' | 'REQUEST' | 'STREAMING' = 'HANDSHAKE';

    socket.on('data', (chunk: Buffer) => {
      if (state === 'STREAMING') {
        bytesSent += chunk.length;
        return;
      }

      if (state === 'HANDSHAKE') {
        // SOCKS5 Handshake: [0x05, NMETHODS, METHODS...]
        if (chunk.length < 2 || chunk[0] !== 0x05) {
          socket.destroy();
          return;
        }

        // Reply: Version 5, Method 0 (No authentication)
        socket.write(Buffer.from([0x05, 0x00]));
        state = 'REQUEST';
        return;
      }

      if (state === 'REQUEST') {
        // SOCKS5 Request: [VER(5), CMD(1), RSV(0), ATYP, DST.ADDR, DST.PORT(2)]
        if (chunk.length < 6 || chunk[0] !== 0x05) {
          socket.destroy();
          return;
        }

        const cmd = chunk[1];
        if (cmd !== 0x01) {
          // Command not supported (0x07)
          socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          socket.destroy();
          return;
        }

        const atyp = chunk[3];
        let targetHost = '';
        let portOffset = 4;

        if (atyp === 0x01) {
          // IPv4
          if (chunk.length < 10) {
            socket.destroy();
            return;
          }
          targetHost = `${chunk[4]}.${chunk[5]}.${chunk[6]}.${chunk[7]}`;
          portOffset = 8;
        } else if (atyp === 0x03) {
          // Domain name
          const domainLen = chunk[4];
          if (chunk.length < 5 + domainLen + 2) {
            socket.destroy();
            return;
          }
          targetHost = chunk.toString('utf-8', 5, 5 + domainLen);
          portOffset = 5 + domainLen;
        } else if (atyp === 0x04) {
          // IPv6
          if (chunk.length < 22) {
            socket.destroy();
            return;
          }
          const ipv6Parts: string[] = [];
          for (let i = 0; i < 16; i += 2) {
            ipv6Parts.push(chunk.readUInt16BE(4 + i).toString(16));
          }
          targetHost = ipv6Parts.join(':');
          portOffset = 20;
        } else {
          // Address type not supported (0x08)
          socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          socket.destroy();
          return;
        }

        const targetPort = chunk.readUInt16BE(portOffset);

        const srcIp = socket.remoteAddress || '127.0.0.1';
        const srcPort = socket.remotePort || 0;

        sshConn.client.forwardOut(
          srcIp,
          srcPort,
          targetHost,
          targetPort,
          (err, stream) => {
            if (err) {
              // Host unreachable (0x04)
              socket.write(Buffer.from([0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
              socket.destroy();
              return;
            }

            state = 'STREAMING';
            // Connection granted (0x00)
            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

            stream.on('data', (sshChunk: Buffer) => {
              bytesReceived += sshChunk.length;
            });

            socket.pipe(stream);
            stream.pipe(socket);

            const cleanup = () => {
              activeSockets.delete(socket);
              try {
                socket.destroy();
              } catch {
                // Ignore
              }
              try {
                stream.end();
              } catch {
                // Ignore
              }
            };

            socket.on('close', cleanup);
            socket.on('error', cleanup);
            stream.on('close', cleanup);
            stream.on('error', cleanup);
          }
        );
      }
    });

    socket.on('error', () => {
      activeSockets.delete(socket);
      try {
        socket.destroy();
      } catch {
        // Ignore
      }
    });
  });

  server.on('error', (err: any) => {
    status = 'error';
    errorMessage = `SOCKS5 server error on ${tunnel.bind_host}:${tunnel.bind_port}: ${err.message}`;
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
