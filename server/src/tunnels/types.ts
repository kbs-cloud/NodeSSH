import { Tunnel, TunnelRuntimeMetrics, TunnelStatus } from '../types';
import net from 'net';
import { Client } from 'ssh2';

export interface ActiveTunnelInstance {
  tunnel: Tunnel;
  status: TunnelStatus;
  startedAt: Date | null;
  errorMessage?: string | null;
  server?: net.Server | null;
  sshClient?: Client | null;
  jumpClient?: Client | null;
  activeSockets: Set<net.Socket>;
  bytesSent: number;
  bytesReceived: number;
  stop: () => Promise<void>;
  getMetrics: () => TunnelRuntimeMetrics;
}
