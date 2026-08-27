import { Router, Response } from 'express';
import os from 'os';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { tunnelManager } from '../tunnels/tunnel-manager';

const router = Router();

router.use(requireAuth);

router.get('/info', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const memory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      processMemory: process.memoryUsage(),
    };

    const systemInfo = {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      uptime: os.uptime(),
      processUptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory,
      networkInterfaces: tunnelManager.getNetworkInterfaces(),
      timestamp: new Date().toISOString(),
    };

    res.json(systemInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
