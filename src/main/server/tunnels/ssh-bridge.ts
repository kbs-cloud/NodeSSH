import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Server as SSHServer } from 'ssh2';
import { Tunnel, TunnelRuntimeMetrics, Profile } from '../types';
import { createSSHConnection } from '../ssh/connection';
import { ActiveTunnelInstance } from './types';
import { config } from '../config';

// Persistent host key so clients don't see host key change warnings across restarts
function getOrCreateHostKey(): string {
  const dataDir = config.dataDir;
  const keyPath = path.join(dataDir, 'bridge_host_key.pem');

  try {
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }
  } catch {}

  const newKey = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  }).privateKey;

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(keyPath, newKey, 'utf8');
  } catch {}

  return newKey;
}

/**
 * Creates an Inbound SSH Proxy Bridge in Node.js.
 * Listens on a local port (e.g. 127.0.0.1:9022) as an SSH server.
 * When any local tool or terminal connects via `ssh -p 9022 localhost`,
 * NodeSSH auto-authenticates to the target remote SSH server using the encrypted
 * credentials/keys stored in the Key Vault and bridges the interactive PTY shell or exec commands.
 */
export function createSSHBridgeTunnel(
  tunnel: Tunnel,
  profile: Profile,
  userId: string
): ActiveTunnelInstance {
  const activeSockets = new Set<any>();
  let bytesSent = 0;
  let bytesReceived = 0;
  let startedAt: Date | null = new Date();
  let status: 'active' | 'stopped' | 'error' = 'active';
  let errorMessage: string | null = null;

  const bindHost = tunnel.bind_host || '127.0.0.1';
  const bindPort = tunnel.bind_port;
  const hostKey = getOrCreateHostKey();

  const server = new SSHServer(
    {
      hostKeys: [hostKey],
    },
    (client) => {
      activeSockets.add(client);

      client.on('authentication', (ctx) => {
        // Accept authentication for local inbound client
        ctx.accept();
      });

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept();
          let ptyRequested: any = null;

          session.once('pty', (acceptPty, _rejectPty, ptyInfo) => {
            acceptPty();
            ptyRequested = ptyInfo;
          });

          // Interactive Shell bridging (e.g. ssh -p 9022 localhost)
          session.once('shell', async (acceptShell) => {
            const localStream = acceptShell();

            try {
              const { client: remoteClient } = await createSSHConnection({
                userId,
                profileId: profile.id,
              });

              remoteClient.shell(
                {
                  term: ptyRequested?.term || 'xterm-256color',
                  cols: ptyRequested?.cols || 80,
                  rows: ptyRequested?.rows || 24,
                },
                (err, remoteStream) => {
                  if (err) {
                    localStream.stderr.write(`\r\n[NodeSSH Bridge] Remote shell error: ${err.message}\r\n`);
                    localStream.exit(1);
                    localStream.end();
                    try {
                      remoteClient.end();
                    } catch {}
                    return;
                  }

                  // Track bandwidth
                  localStream.on('data', (chunk: Buffer) => {
                    bytesSent += chunk.length;
                  });
                  remoteStream.on('data', (chunk: Buffer) => {
                    bytesReceived += chunk.length;
                  });

                  localStream.pipe(remoteStream);
                  remoteStream.pipe(localStream);

                  // Handle terminal window resize
                  session.on('window-change', (acceptWin, _rejectWin, winInfo) => {
                    try {
                      remoteStream.setWindow(winInfo.rows, winInfo.cols, 0, 0);
                    } catch {}
                    if (acceptWin) acceptWin();
                  });

                  const cleanup = () => {
                    try {
                      remoteClient.end();
                    } catch {}
                    try {
                      localStream.end();
                    } catch {}
                  };

                  remoteStream.on('close', cleanup);
                  remoteStream.on('error', cleanup);
                  localStream.on('close', cleanup);
                  localStream.on('error', cleanup);
                }
              );
            } catch (err: any) {
              localStream.stderr.write(`\r\n[NodeSSH Bridge] Failed to connect to ${profile.username}@${profile.host}: ${err.message}\r\n`);
              localStream.exit(1);
              localStream.end();
            }
          });

          // Command execution bridging (e.g. ssh -p 9022 localhost "uname -a")
          session.once('exec', async (acceptExec, _rejectExec, info) => {
            const localStream = acceptExec();

            try {
              const { client: remoteClient } = await createSSHConnection({
                userId,
                profileId: profile.id,
              });

              remoteClient.exec(info.command, (err, remoteStream) => {
                if (err) {
                  localStream.stderr.write(`\r\n[NodeSSH Bridge] Remote exec error: ${err.message}\r\n`);
                  localStream.exit(1);
                  localStream.end();
                  try {
                    remoteClient.end();
                  } catch {}
                  return;
                }

                localStream.on('data', (chunk: Buffer) => {
                  bytesSent += chunk.length;
                });
                remoteStream.on('data', (chunk: Buffer) => {
                  bytesReceived += chunk.length;
                });

                localStream.pipe(remoteStream);
                remoteStream.pipe(localStream);
                remoteStream.stderr.pipe(localStream.stderr);

                remoteStream.on('close', (code: number) => {
                  try {
                    remoteClient.end();
                  } catch {}
                  localStream.exit(code || 0);
                  localStream.end();
                });
              });
            } catch (err: any) {
              localStream.stderr.write(`\r\n[NodeSSH Bridge] Connection failed: ${err.message}\r\n`);
              localStream.exit(1);
              localStream.end();
            }
          });

          // SFTP Subsystem bridging (e.g. sftp -P 9022 localhost or FileZilla / WinSCP)
          const handleSftpSubsystem = async (acceptSftp: () => any) => {
            const localStream = acceptSftp();
            try {
              const { client: remoteClient } = await createSSHConnection({
                userId,
                profileId: profile.id,
              });

              remoteClient.subsys('sftp', (err, remoteStream) => {
                if (err) {
                  try {
                    remoteClient.end();
                  } catch {}
                  localStream.exit(1);
                  localStream.end();
                  return;
                }

                localStream.on('data', (chunk: Buffer) => {
                  bytesSent += chunk.length;
                });
                remoteStream.on('data', (chunk: Buffer) => {
                  bytesReceived += chunk.length;
                });

                localStream.pipe(remoteStream);
                remoteStream.pipe(localStream);

                const cleanup = () => {
                  try {
                    remoteClient.end();
                  } catch {}
                  try {
                    localStream.end();
                  } catch {}
                };

                remoteStream.on('close', cleanup);
                remoteStream.on('error', cleanup);
                localStream.on('close', cleanup);
                localStream.on('error', cleanup);
              });
            } catch {
              try {
                localStream.exit(1);
                localStream.end();
              } catch {}
            }
          };

          session.once('sftp', (accept) => handleSftpSubsystem(accept));
          session.once('subsystem', (accept, _reject, info) => {
            if (info.name === 'sftp') {
              handleSftpSubsystem(accept);
            }
          });
        });
      });

      const removeClient = () => {
        activeSockets.delete(client);
      };

      client.on('close', removeClient);
      client.on('end', removeClient);
      client.on('error', removeClient);
    }
  );

  server.on('error', (err: any) => {
    status = 'error';
    errorMessage = `SSH Bridge error on port ${bindPort}: ${err.message}`;
  });

  server.listen(bindPort, '0.0.0.0', () => {
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
      for (const client of activeSockets) {
        try {
          client.end();
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
