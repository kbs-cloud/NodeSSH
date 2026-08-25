import os from 'os';
import { Tunnel, ActiveTunnelInfo, TunnelRuntimeMetrics, NetworkInterfaceInfo } from '../types';
import { getTunnelById, getTunnelsByUserId, getAutoStartTunnels } from '../db/tunnels';
import { getProfileById, getProfilesByUserId } from '../db/profiles';
import { createSSHConnection } from '../ssh/connection';
import { ActiveTunnelInstance } from './types';
import { createLocalForwardTunnel } from './local-forward';
import { createRemoteForwardTunnel } from './remote-forward';
import { createSocks5ProxyTunnel } from './socks5-server';
import { createDirectTcpProxy } from './direct-proxy';

class TunnelManager {
  private activeTunnels: Map<string, ActiveTunnelInstance> = new Map();

  /**
   * Starts an active tunnel instance
   */
  public async startTunnel(userId: string, tunnelId: string): Promise<TunnelRuntimeMetrics> {
    const tunnel = getTunnelById(userId, tunnelId);
    if (!tunnel) {
      throw new Error(`Tunnel with ID '${tunnelId}' not found`);
    }

    if (this.activeTunnels.has(tunnel.id)) {
      const existing = this.activeTunnels.get(tunnel.id)!;
      if (existing.status === 'active') {
        return existing.getMetrics();
      }
      await this.stopTunnel(userId, tunnelId);
    }

    // Direct Node TCP Proxy Mode: No SSH connection needed
    if (tunnel.tunnel_type === 'direct' || tunnel.tunnel_type === 'proxy' || tunnel.tunnel_type === 'tcp') {
      const instance = createDirectTcpProxy(tunnel);
      this.activeTunnels.set(tunnel.id, instance);
      return instance.getMetrics();
    }

    let profile = tunnel.profile_id ? getProfileById(userId, tunnel.profile_id) : null;
    if (!profile) {
      const allProfiles = getProfilesByUserId(userId);
      if (allProfiles.length > 0) {
        profile = allProfiles[0];
      }
    }

    // If no profile found but local forward requested, fall back smoothly to direct Node TCP proxy
    if (!profile) {
      if (tunnel.tunnel_type === 'local') {
        const instance = createDirectTcpProxy(tunnel);
        this.activeTunnels.set(tunnel.id, instance);
        return instance.getMetrics();
      }
      throw new Error(`No SSH server profile found to route tunnel '${tunnel.name}'. Please create a Server Profile first.`);
    }

    const sshConn = await createSSHConnection({
      userId,
      profileId: profile.id,
    });

    let instance: ActiveTunnelInstance;

    try {
      if (tunnel.tunnel_type === 'remote') {
        instance = await createRemoteForwardTunnel(tunnel, sshConn);
      } else if (tunnel.tunnel_type === 'socks5' || tunnel.tunnel_type === 'dynamic') {
        instance = createSocks5ProxyTunnel(tunnel, sshConn);
      } else {
        // Default: local port forwarding through SSH
        instance = createLocalForwardTunnel(tunnel, sshConn);
      }

      this.activeTunnels.set(tunnel.id, instance);
      return instance.getMetrics();
    } catch (err: any) {
      try {
        sshConn.client.end();
      } catch {}
      if (sshConn.jumpClient) {
        try {
          sshConn.jumpClient.end();
        } catch {}
      }
      throw new Error(`Failed to start tunnel: ${err.message}`);
    }
  }

  /**
   * Stops an active tunnel instance
   */
  public async stopTunnel(userId: string, tunnelId: string): Promise<void> {
    const instance = this.activeTunnels.get(tunnelId);
    if (!instance) {
      return;
    }

    if (instance.tunnel.user_id !== userId) {
      throw new Error('Unauthorized to stop this tunnel');
    }

    await instance.stop();
    this.activeTunnels.delete(tunnelId);
  }

  /**
   * Gets metrics for a specific tunnel
   */
  public getTunnelMetrics(userId: string, tunnelId: string): TunnelRuntimeMetrics {
    const instance = this.activeTunnels.get(tunnelId);
    if (instance && instance.tunnel.user_id === userId) {
      return instance.getMetrics();
    }

    return {
      activeConnections: 0,
      bytesSent: 0,
      bytesReceived: 0,
      uptimeSeconds: 0,
      status: 'stopped',
      errorMessage: null,
      startedAt: null,
    };
  }

  /**
   * Lists all tunnels for a user enriched with live runtime metrics
   */
  public getAllTunnelsWithMetrics(userId: string): ActiveTunnelInfo[] {
    const tunnels = getTunnelsByUserId(userId);
    return tunnels.map((t) => {
      const instance = this.activeTunnels.get(t.id);
      const metrics = instance
        ? instance.getMetrics()
        : {
            activeConnections: 0,
            bytesSent: 0,
            bytesReceived: 0,
            uptimeSeconds: 0,
            status: 'stopped' as const,
            errorMessage: null,
            startedAt: null,
          };

      return {
        ...t,
        metrics,
      };
    });
  }

  /**
   * Returns host network interfaces for LAN sharing selection
   */
  public getNetworkInterfaces(): NetworkInterfaceInfo[] {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterfaceInfo[] = [
      { name: 'all', address: '0.0.0.0', family: 'IPv4', internal: false },
      { name: 'localhost', address: '127.0.0.1', family: 'IPv4', internal: true },
    ];

    for (const [name, netList] of Object.entries(interfaces)) {
      if (!netList) continue;
      for (const info of netList) {
        if (info.family === 'IPv4' && info.address !== '127.0.0.1') {
          result.push({
            name,
            address: info.address,
            family: info.family,
            internal: info.internal,
          });
        }
      }
    }

    return result;
  }

  /**
   * Automatically starts all tunnels configured with auto_start on server initialization
   */
  public async initAutoStartTunnels(): Promise<void> {
    const autoTunnels = getAutoStartTunnels();
    for (const tunnel of autoTunnels) {
      try {
        await this.startTunnel(tunnel.user_id, tunnel.id);
        console.log(`[TunnelManager] Auto-started tunnel '${tunnel.name}' (Port ${tunnel.bind_port})`);
      } catch (err: any) {
        console.error(`[TunnelManager] Failed to auto-start tunnel '${tunnel.name}': ${err.message}`);
      }
    }
  }

  /**
   * Stops all active tunnels cleanly
   */
  public async stopAll(): Promise<void> {
    for (const [id, instance] of this.activeTunnels.entries()) {
      try {
        await instance.stop();
      } catch {}
    }
    this.activeTunnels.clear();
  }
}

export const tunnelManager = new TunnelManager();
