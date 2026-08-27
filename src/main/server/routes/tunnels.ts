import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import {
  createTunnel,
  getTunnelById,
  updateTunnel,
  deleteTunnel,
} from '../db/tunnels';
import { tunnelManager } from '../tunnels/tunnel-manager';
import { TunnelCreateDTO } from '../types';

const router = Router();

router.use(requireAuth);

function normalizeTunnelInput(body: any): TunnelCreateDTO {
  return {
    profile_id: body.profile_id || body.sshProfileId || body.profileId || '',
    name: body.name || 'SSH Tunnel',
    tunnel_type: body.tunnel_type || body.type || 'local',
    bind_host: body.bind_host || body.bindHost || '127.0.0.1',
    bind_port: Number(body.bind_port || body.bindPort || 8080),
    dest_host: body.dest_host || body.remoteHost || body.destHost || undefined,
    dest_port: body.dest_port ? Number(body.dest_port) : body.remotePort ? Number(body.remotePort) : undefined,
    auto_start: body.auto_start !== undefined ? Boolean(body.auto_start) : body.autoStart !== undefined ? Boolean(body.autoStart) : true,
  };
}

function toTunnelDTO(tunnel: any) {
  const metrics = tunnel.metrics || {};
  return {
    id: tunnel.id,
    userId: tunnel.user_id,
    profileId: tunnel.profile_id,
    sshProfileId: tunnel.profile_id,
    name: tunnel.name,
    type: tunnel.tunnel_type,
    tunnel_type: tunnel.tunnel_type,
    bindHost: tunnel.bind_host,
    bind_host: tunnel.bind_host,
    bindPort: tunnel.bind_port,
    bind_port: tunnel.bind_port,
    remoteHost: tunnel.dest_host || '',
    dest_host: tunnel.dest_host || '',
    remotePort: tunnel.dest_port || 0,
    dest_port: tunnel.dest_port || 0,
    autoStart: tunnel.auto_start !== 0,
    auto_start: tunnel.auto_start !== 0,
    status: metrics.status || 'stopped',
    activeClients: metrics.activeConnections || 0,
    bytesIn: metrics.bytesReceived || 0,
    bytesOut: metrics.bytesSent || 0,
    uptimeSeconds: metrics.uptimeSeconds || 0,
    errorMessage: metrics.errorMessage || null,
    createdAt: tunnel.created_at,
  };
}

// Get host network interfaces (LAN IPs)
router.get('/network-interfaces', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const ifaces = tunnelManager.getNetworkInterfaces();
    res.json(ifaces);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all tunnels for user with live metrics
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tunnels = tunnelManager.getAllTunnelsWithMetrics(userId);
    res.json(tunnels.map(toTunnelDTO));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Tunnel
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const normalized = normalizeTunnelInput(req.body);

    if (!normalized.name || !normalized.tunnel_type || !normalized.bind_port) {
      res.status(400).json({ error: 'Name, Tunnel Type, and Bind Port are required' });
      return;
    }

    const tunnel = createTunnel(userId, normalized);
    const metrics = tunnelManager.getTunnelMetrics(userId, tunnel.id);

    res.status(201).json(toTunnelDTO({ ...tunnel, metrics }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get Tunnel by ID with metrics
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tunnel = getTunnelById(userId, req.params.id);
    if (!tunnel) {
      res.status(404).json({ error: 'Tunnel not found' });
      return;
    }

    const metrics = tunnelManager.getTunnelMetrics(userId, tunnel.id);
    res.json(toTunnelDTO({ ...tunnel, metrics }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Tunnel
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const normalized = normalizeTunnelInput(req.body);
    const updated = updateTunnel(userId, req.params.id, normalized);
    if (!updated) {
      res.status(404).json({ error: 'Tunnel not found' });
      return;
    }

    const metrics = tunnelManager.getTunnelMetrics(userId, updated.id);
    res.json(toTunnelDTO({ ...updated, metrics }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Tunnel
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tunnelId = req.params.id;

    // Stop tunnel if active
    await tunnelManager.stopTunnel(userId, tunnelId);

    const success = deleteTunnel(userId, tunnelId);
    if (!success) {
      res.status(404).json({ error: 'Tunnel not found' });
      return;
    }

    res.json({ message: 'Tunnel deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Tunnel instance
router.post('/:id/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tunnelId = req.params.id;

    const metrics = await tunnelManager.startTunnel(userId, tunnelId);
    const tunnel = getTunnelById(userId, tunnelId);
    if (!tunnel) {
      res.status(404).json({ error: 'Tunnel not found' });
      return;
    }

    res.json(toTunnelDTO({
      ...tunnel,
      metrics,
    }));
  } catch (err: any) {
    res.status(500).json({ error: `Failed to start tunnel: ${err.message}` });
  }
});

// Stop Tunnel instance
router.post('/:id/stop', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tunnelId = req.params.id;

    await tunnelManager.stopTunnel(userId, tunnelId);
    const metrics = tunnelManager.getTunnelMetrics(userId, tunnelId);
    const tunnel = getTunnelById(userId, tunnelId);
    if (!tunnel) {
      res.status(404).json({ error: 'Tunnel not found' });
      return;
    }

    res.json(toTunnelDTO({
      ...tunnel,
      metrics,
    }));
  } catch (err: any) {
    res.status(500).json({ error: `Failed to stop tunnel: ${err.message}` });
  }
});

export default router;
