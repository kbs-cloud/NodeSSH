import { WebSocket } from 'ws';
import { ClientChannel } from 'ssh2';
import { StringDecoder } from 'string_decoder';
import * as pty from 'node-pty';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createSSHConnection, SSHConnectionResult } from './connection';
import { WSTerminalInitMessage, WSTerminalClientMessage } from '../types';
import { getProfileById } from '../db/profiles';

function getDefaultLocalShell(): string {
  if (process.platform === 'win32') {
    if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
      return process.env.SHELL;
    }
    const sysRoot = process.env.SystemRoot || 'C:\\Windows';
    const powershellPath = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(powershellPath)) {
      return powershellPath;
    }
    return process.env.COMSPEC || 'cmd.exe';
  }

  if (process.platform === 'darwin') {
    if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
      return process.env.SHELL;
    }
    if (fs.existsSync('/bin/zsh')) return '/bin/zsh';
    if (fs.existsSync('/bin/bash')) return '/bin/bash';
    return '/bin/sh';
  }

  // Linux / Unix
  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
    return process.env.SHELL;
  }
  if (fs.existsSync('/bin/bash')) return '/bin/bash';
  if (fs.existsSync('/usr/bin/bash')) return '/usr/bin/bash';
  if (fs.existsSync('/bin/zsh')) return '/bin/zsh';
  return '/bin/sh';
}

export class TerminalSession {
  private ws: WebSocket;
  private userId: string;
  private isLocal: boolean = false;
  private ptyProcess: pty.IPty | null = null;
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
      const isLocal = initMsg.isLocal || (!initMsg.host && !initMsg.profileId);

      if (isLocal) {
        await this.initializeLocalShell(initMsg);
        return;
      }

      await this.initializeSshSession(initMsg);
    } catch (err: any) {
      this.send({ type: 'error', message: err.message || 'Session initialization failed' });
      this.destroy();
    }
  }

  private async initializeLocalShell(initMsg: WSTerminalInitMessage): Promise<void> {
    this.isLocal = true;
    this.send({ type: 'status', status: 'connecting', message: 'Starting local shell...' });

    const shell = initMsg.shell || getDefaultLocalShell();
    const cols = initMsg.cols && initMsg.cols > 0 ? initMsg.cols : 80;
    const rows = initMsg.rows && initMsg.rows > 0 ? initMsg.rows : 24;
    const cwd = initMsg.initialDir && fs.existsSync(initMsg.initialDir)
      ? initMsg.initialDir
      : os.homedir();

    const env = {
      ...process.env,
      TERM: initMsg.term || 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    const ptyProcess = pty.spawn(shell, [], {
      name: initMsg.term || 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
    });

    this.ptyProcess = ptyProcess;
    this.send({ type: 'status', status: 'connected', message: 'Local shell ready' });
    this.send({ type: 'cwd', path: cwd });

    if (initMsg.initialCommand) {
      setTimeout(() => {
        if (this.ptyProcess) {
          this.ptyProcess.write(`${initMsg.initialCommand}\r\n`);
        }
      }, 300);
    }

    ptyProcess.onData((data: string) => {
      this.send({ type: 'data', data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.ptyProcess = null;
      this.send({ type: 'exit', code: exitCode, signal: signal !== undefined ? String(signal) : null });
      this.destroy();
    });
  }

  private async initializeSshSession(initMsg: WSTerminalInitMessage): Promise<void> {
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

        const stdoutDecoder = new StringDecoder('utf8');
        const stderrDecoder = new StringDecoder('utf8');

        // Stream SSH stdout/stderr to WebSocket
        stream.on('data', (data: Buffer) => {
          const str = stdoutDecoder.write(data);
          if (str) {
            this.send({ type: 'data', data: str });
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          const str = stderrDecoder.write(data);
          if (str) {
            this.send({ type: 'data', data: str });
          }
        });

        stream.on('close', (code: number, signal: string) => {
          const restOut = stdoutDecoder.end();
          if (restOut) this.send({ type: 'data', data: restOut });
          const restErr = stderrDecoder.end();
          if (restErr) this.send({ type: 'data', data: restErr });
          this.send({ type: 'exit', code, signal });
          this.destroy();
        });
      }
    );
  }

  public handleMessage(msg: WSTerminalClientMessage): void {
    if (msg.type === 'data') {
      if (this.isLocal && this.ptyProcess) {
        this.ptyProcess.write(msg.data);
      } else if (this.stream && this.stream.writable) {
        this.stream.write(msg.data);
      }
    } else if (msg.type === 'resize') {
      if (msg.cols && msg.rows && msg.cols > 0 && msg.rows > 0) {
        if (this.isLocal && this.ptyProcess) {
          try {
            this.ptyProcess.resize(msg.cols, msg.rows);
          } catch {
            // Ignore resize errors if pty is closing
          }
        } else if (this.stream) {
          try {
            this.stream.setWindow(msg.rows, msg.cols, 0, 0);
          } catch {
            // Ignore resize errors if stream is closing
          }
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
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch {
        // Ignore
      }
      this.ptyProcess = null;
    }

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
