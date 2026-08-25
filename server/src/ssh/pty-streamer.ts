import { WebSocket } from 'ws';
import { ClientChannel } from 'ssh2';
import { createSSHConnection, SSHConnectionResult } from './connection';
import { WSTerminalInitMessage, WSTerminalClientMessage } from '../types';
import { getProfileById } from '../db/profiles';

export class TerminalSession {
  private ws: WebSocket;
  private userId: string;
  private sshConn: SSHConnectionResult | null = null;
  private stream: ClientChannel | null = null;
  private closeOnExit: boolean = true;
  private isAlive: boolean = true;

  constructor(ws: WebSocket, userId: string) {
    this.ws = ws;
    this.userId = userId;
  }

  public async initialize(initMsg: WSTerminalInitMessage): Promise<void> {
    try {
      this.send({ type: 'status', status: 'connecting', message: 'Establishing SSH connection...' });

      let initialDir: string | undefined;
      let startupCommand: string | undefined;

      if (initMsg.profileId) {
        const profile = getProfileById(this.userId, initMsg.profileId);
        if (profile) {
          this.closeOnExit = profile.close_on_exit !== 0;
          initialDir = profile.initial_dir || undefined;
          startupCommand = profile.startup_command || undefined;
        }
      }

      if (initMsg.close_on_exit !== undefined) {
        this.closeOnExit = initMsg.close_on_exit;
      }

      this.sshConn = await createSSHConnection({
        userId: this.userId,
        profileId: initMsg.profileId,
        host: initMsg.host,
        port: initMsg.port,
        username: initMsg.username,
        password: initMsg.password,
        keyId: initMsg.keyId,
        privateKey: initMsg.privateKey,
        passphrase: initMsg.passphrase,
        jumpHostId: initMsg.jumpHostId,
      });

      const cols = initMsg.cols || 80;
      const rows = initMsg.rows || 24;
      const term = initMsg.term || 'xterm-256color';

      this.sshConn.client.shell(
        {
          term,
          cols,
          rows,
        },
        (err, stream) => {
          if (err) {
            this.send({ type: 'error', message: `Shell initialization failed: ${err.message}` });
            this.destroy();
            return;
          }

          this.stream = stream;
          this.send({ type: 'status', status: 'connected', message: 'Terminal ready' });

          // Send initial directory or startup commands if configured
          if (initialDir) {
            stream.write(`cd "${initialDir}"\n`);
          }
          if (startupCommand) {
            stream.write(`${startupCommand}\n`);
          }

          // Stream SSH stdout/stderr to WebSocket
          stream.on('data', (data: Buffer) => {
            this.send({ type: 'data', data: data.toString('utf-8') });
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.send({ type: 'data', data: data.toString('utf-8') });
          });

          stream.on('close', (code: number, signal: string) => {
            this.send({ type: 'exit', code, signal });
            this.destroy();
          });
        }
      );
    } catch (err: any) {
      this.send({ type: 'error', message: err.message || 'SSH connection failed' });
      this.destroy();
    }
  }

  public handleMessage(msg: WSTerminalClientMessage): void {
    if (msg.type === 'data') {
      if (this.stream && this.stream.writable) {
        this.stream.write(msg.data);
      }
    } else if (msg.type === 'resize') {
      if (this.stream && msg.cols && msg.rows) {
        try {
          this.stream.setWindow(msg.rows, msg.cols, 0, 0);
        } catch {
          // Ignore resize errors if stream is closing
        }
      }
    } else if (msg.type === 'ping') {
      this.send({ type: 'pong' });
    }
  }

  /**
   * Called when WebSocket connection is closed (e.g. browser tab closed)
   */
  public handleClose(): void {
    this.isAlive = false;
    if (this.closeOnExit) {
      this.destroy();
    }
  }

  public destroy(): void {
    if (this.stream) {
      try {
        this.stream.write('\x03\x04'); // Send SIGINT and EOF
        this.stream.end();
        this.stream.close();
      } catch {
        // Stream may already be closed
      }
      this.stream = null;
    }

    if (this.sshConn) {
      try {
        this.sshConn.client.end();
        this.sshConn.client.destroy();
      } catch {
        // Ignore
      }
      if (this.sshConn.jumpClient) {
        try {
          this.sshConn.jumpClient.end();
          this.sshConn.jumpClient.destroy();
        } catch {
          // Ignore
        }
      }
      this.sshConn = null;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  private send(data: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {
        // Ignore send errors during teardown
      }
    }
  }
}
