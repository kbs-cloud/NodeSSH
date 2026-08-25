import { ServerProfile } from '../types';
import { MockShell } from '../utils/mockShell';
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

export class TerminalSession {
  public tabId: string;
  public profile?: Partial<ServerProfile>;
  public status: TerminalSessionStatus = 'connecting';
  public cwd: string = '/home/ubuntu';
  public latencyMs: number = 12;

  private ws: WebSocket | null = null;
  private mockShell: MockShell | null = null;
  private isMock: boolean = false;
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
    const isPackaged = typeof window !== 'undefined' && 
      (window.location.protocol === 'file:' || window.location.hostname === '');
    
    if (isPackaged) {
      this.initMockShell();
      return;
    }

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;
    if (window.location.port === '5173') {
      wsHost = `${window.location.hostname || 'localhost'}:3001`;
    }
    const token = storage.getToken() || 'default-session-token';
    const wsUrl = `${wsProto}//${wsHost}/ws/terminal?tabId=${encodeURIComponent(this.tabId)}&token=${encodeURIComponent(token)}`;

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
            // Check if JSON protocol message or raw text
            if (event.data.startsWith('{') && event.data.endsWith('}')) {
              const msg = JSON.parse(event.data);
              if (msg.type === 'data') {
                this.options.onData(msg.data);
              } else if (msg.type === 'status') {
                this.status = msg.status;
                this.options.onStatusChange(msg.status, msg.message);
                if (msg.message && msg.status === 'connecting') {
                  this.options.onData(`\r\n\x1b[36mConnecting to ${this.profile?.username || 'remote'}@${this.profile?.host || 'server'}:${this.profile?.port || 22}...\x1b[0m\r\n`);
                }
              } else if (msg.type === 'error') {
                this.options.onData(`\r\n\x1b[31;1m[NodeSSH Connection Error] ${msg.message}\x1b[0m\r\n`);
                this.status = 'error';
                this.options.onStatusChange('error', msg.message);
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
        if (this.status === 'connecting') {
          // Switch gracefully to local shell simulation
          this.initMockShell();
        } else {
          this.status = 'error';
          this.options.onStatusChange('error', 'Connection lost');
        }
      };

      this.ws.onclose = () => {
        if (this.isDisposed) return;
        if (!this.isMock) {
          this.status = 'disconnected';
          this.options.onStatusChange('disconnected');
        }
      };
    } catch {
      this.initMockShell();
    }
  }

  private initMockShell(): void {
    this.isMock = true;
    this.status = 'connected';
    this.options.onStatusChange('connected');
    this.mockShell = new MockShell(
      this.profile?.username || 'ubuntu',
      this.profile?.host || 'nodessh-srv01'
    );

    // Initial connection simulation delay
    setTimeout(() => {
      if (this.isDisposed || !this.mockShell) return;
      this.options.onData(this.mockShell.getWelcomeBanner());
      
      if (this.options.initialCommand || this.profile?.startupCommand) {
        const cmd = this.options.initialCommand || this.profile?.startupCommand || '';
        setTimeout(() => {
          if (this.isDisposed || !this.mockShell) return;
          this.options.onData(cmd + '\r\n');
          const res = this.mockShell.executeCommand(cmd);
          this.options.onData(res.text + (res.suppressPrompt ? '' : this.mockShell.getPrompt()));
        }, 400);
      }
    }, 200);

    this.startLatencyPing();
  }

  private startLatencyPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.isDisposed) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping', timestamp: Date.now() });
      } else if (this.isMock) {
        // Jitter simulation 8ms - 24ms
        this.latencyMs = Math.floor(10 + Math.random() * 15);
        this.options.onLatencyChange?.(this.latencyMs);
      }
    }, 5000);
  }

  public sendInput(data: string): void {
    if (this.isDisposed) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'data', data });
    } else if (this.isMock && this.mockShell) {
      const res = this.mockShell.handleInput(data);
      if (res.output) {
        this.options.onData(res.output);
      }
      if (res.newCwd) {
        this.cwd = res.newCwd;
        this.options.onCwdChange?.(res.newCwd);
      }
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.isDisposed) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'resize', cols, rows });
    }
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
