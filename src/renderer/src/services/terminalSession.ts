import { ServerProfile } from '../types';
import { storage } from './storage';

export type TerminalSessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TerminalSessionOptions {
  tabId: string;
  profile?: Partial<ServerProfile>;
  initialCommand?: string;
  cols: number;
  rows: number;
  onData: (data: string) => void;
  onStatusChange: (status: TerminalSessionStatus, message?: string) => void;
  onCwdChange?: (cwd: string) => void;
  onLatencyChange?: (latencyMs: number) => void;
}

export function getWebSocketUrl(tabId: string, token: string = 'default-session-token'): string {
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  let wsHost = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:3001';
  if (isFileProto || !wsHost || (typeof window !== 'undefined' && window.location.port === '5173')) {
    const hostname =
      typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== ''
        ? window.location.hostname
        : '127.0.0.1';
    wsHost = `${hostname}:3001`;
  }

  return `${wsProto}//${wsHost}/ws/terminal?tabId=${encodeURIComponent(tabId)}&token=${encodeURIComponent(token)}`;
}

export class TerminalSession {
  public tabId: string;
  public profile?: Partial<ServerProfile>;
  public status: TerminalSessionStatus = 'connecting';
  public cwd: string = '~';
  public latencyMs: number = 0;

  private ws: WebSocket | null = null;
  private pingInterval: any = null;
  private options: TerminalSessionOptions;
  private isDisposed: boolean = false;

  constructor(options: TerminalSessionOptions) {
    this.options = options;
    this.tabId = options.tabId;
    this.profile = options.profile;
    this.init();
  }

  private init(): void {
    const token = storage.getToken() || 'default-session-token';
    const wsUrl = getWebSocketUrl(this.tabId, token);
    const isLocal = !this.profile?.host && !this.profile?.id;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isDisposed) return;
        this.status = 'connected';
        this.options.onStatusChange('connected');
        
        // Send init message
        this.sendMessage({
          type: 'init',
          tabId: this.tabId,
          isLocal,
          profileId: this.profile?.id,
          host: this.profile?.host,
          port: this.profile?.port || 22,
          username: this.profile?.username,
          password: this.profile?.password,
          keyId: this.profile?.keyId,
          jumpHostId: this.profile?.jumpHostId,
          cols: this.options.cols,
          rows: this.options.rows,
          initialCommand: this.options.initialCommand || this.profile?.startupCommand,
        });

        this.startLatencyPing();
      };

      this.ws.onmessage = (event) => {
        if (this.isDisposed) return;
        try {
          if (typeof event.data === 'string') {
            if (event.data.startsWith('{') && event.data.endsWith('}')) {
              const msg = JSON.parse(event.data);
              if (msg.type === 'data') {
                this.options.onData(msg.data);
              } else if (msg.type === 'status') {
                this.status = msg.status;
                this.options.onStatusChange(msg.status, msg.message);
                if (msg.message && msg.status === 'connecting' && !isLocal) {
                  this.options.onData(`\r\n\x1b[36mConnecting to ${this.profile?.username || 'remote'}@${this.profile?.host || 'server'}:${this.profile?.port || 22}...\x1b[0m\r\n`);
                }
              } else if (msg.type === 'error') {
                this.options.onData(`\r\n\x1b[31;1m[NodeSSH Connection Error] ${msg.message}\x1b[0m\r\n\x1b[36mType \x1b[1;32m'R'\x1b[0;36m to retry connection, or \x1b[1;31m'Esc'\x1b[0;36m / \x1b[1;31m'X'\x1b[0;36m to close tab.\x1b[0m\r\n`);
                this.status = 'error';
                this.options.onStatusChange('error', msg.message);
              } else if (msg.type === 'exit') {
                this.status = 'disconnected';
                this.options.onStatusChange('disconnected');
                this.options.onData(`\r\n\x1b[90m--------------------------------------------------\x1b[0m\r\n\x1b[33;1m[NodeSSH Process Terminated${msg.code !== null && msg.code !== undefined ? ` (code ${msg.code})` : ''}]\x1b[0m\r\n\x1b[36mType \x1b[1;32m'R'\x1b[0;36m to reconnect, or \x1b[1;31m'Esc'\x1b[0;36m / \x1b[1;31m'X'\x1b[0;36m to close tab.\x1b[0m\r\n\x1b[90m--------------------------------------------------\x1b[0m\r\n`);
              } else if (msg.type === 'cwd') {
                this.cwd = msg.path;
                this.options.onCwdChange?.(msg.path);
              } else if (msg.type === 'pong') {
                const rtt = Date.now() - msg.timestamp;
                this.latencyMs = Math.max(1, Math.round(rtt / 2));
                this.options.onLatencyChange?.(this.latencyMs);
              }
            } else {
              this.options.onData(event.data);
            }
          } else if (event.data instanceof ArrayBuffer) {
            const text = new TextDecoder().decode(event.data);
            this.options.onData(text);
          }
        } catch {
          this.options.onData(event.data);
        }
      };

      this.ws.onerror = () => {
        if (this.isDisposed) return;
        this.status = 'error';
        const errMsg = 'Could not connect to WebSocket terminal server';
        this.options.onStatusChange('error', errMsg);
        this.options.onData(`\r\n\x1b[31;1m[NodeSSH Connection Error] ${errMsg} (${wsUrl})\x1b[0m\r\n\x1b[33mEnsure the NodeSSH backend server is running on port 3001.\x1b[0m\r\n\x1b[36mPress \x1b[1;32m'R'\x1b[0;36m to retry connection, or close tab.\x1b[0m\r\n`);
      };

      this.ws.onclose = () => {
        if (this.isDisposed) return;
        const wasConnected = this.status === 'connected';
        this.status = 'disconnected';
        this.options.onStatusChange('disconnected');
        if (wasConnected) {
          this.options.onData(`\r\n\x1b[90m--------------------------------------------------\x1b[0m\r\n\x1b[33;1m[NodeSSH Session Disconnected]\x1b[0m\r\n\x1b[36mType \x1b[1;32m'R'\x1b[0;36m to reconnect, or close tab.\x1b[0m\r\n\x1b[90m--------------------------------------------------\x1b[0m\r\n`);
        }
      };
    } catch (e: any) {
      this.status = 'error';
      this.options.onStatusChange('error', e.message || 'Connection failed');
      this.options.onData(`\r\n\x1b[31;1m[NodeSSH Error] Failed to open WebSocket: ${e.message || 'Unknown error'}\x1b[0m\r\n\x1b[36mPress \x1b[1;32m'R'\x1b[0;36m to retry connection.\x1b[0m\r\n`);
    }
  }

  private startLatencyPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.isDisposed) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping', timestamp: Date.now() });
      }
    }, 5000);
  }

  public sendInput(data: string): void {
    if (this.isDisposed) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'data', data });
    } else if (this.status === 'error' || this.status === 'disconnected') {
      if (data === 'r' || data === 'R') {
        this.reconnect();
      }
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.isDisposed) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'resize', cols, rows });
    }
  }

  public reconnect(): void {
    if (this.status === 'connecting') return;
    this.isDisposed = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.status = 'connecting';
    this.options.onStatusChange('connecting');
    this.options.onData('\r\n\x1b[36;1m[NodeSSH] Reconnecting session...\x1b[0m\r\n');
    this.init();
  }

  public disconnect(killRemoteSession: boolean = true): void {
    this.isDisposed = true;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: killRemoteSession ? 'kill' : 'detach',
          tabId: this.tabId,
        });
        this.ws.close();
      }
      this.ws = null;
    }

    this.status = 'disconnected';
    this.options.onStatusChange('disconnected');
  }

  private sendMessage(msg: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
