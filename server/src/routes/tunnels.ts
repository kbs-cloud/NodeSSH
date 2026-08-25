import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import {
  createTunnel,
  getTunnelById,
  updateTunnel,
  deleteTunnel,
} from '../db/tunnels';
import { tunnelManager } from '../tunnels/tunnel-manager';

const router = Router();

router.use(requireAuth);

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
    res.json(tunnels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Tunnel
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { profile_id, name, tunnel_type, bind_port } = req.body;

    if (!profile_id || !name || !tunnel_type || !bind_port) {
      res.status(400).json({ error: 'Profile, Name, Tunnel Type, and Bind Port are required' });
      return;
    }

    const tunnel = createTunnel(userId, req.body);
    const metrics = tunnelManager.getTunnelMetrics(userId, tunnel.id);

    res.status(201).json({
      ...tunnel,
      metrics,
    });
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
    res.json({
      ...tunnel,
      metrics,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Tunnel
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updated = updateTunnel(userId, req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Tunnel not found' });
      return;
    }

    const metrics = tunnelManager.getTunnelMetrics(userId, updated.id);
    res.json({
      ...updated,
      metrics,
    });
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
    res.json({
      message: 'Tunnel started successfully',
      metrics,
    });
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

    res.json({
      message: 'Tunnel stopped successfully',
      metrics,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to stop tunnel: ${err.message}` });
  }
});

export default router;
