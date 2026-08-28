import { Router, Request, Response } from 'express';
import os from 'os';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { tunnelManager } from '../tunnels/tunnel-manager';

const router = Router();

export function getPrimaryLanIp(): string {
  const interfaces = os.networkInterfaces();
  const list: { name: string; address: string; score: number }[] = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const info of netList) {
      if (info.family === 'IPv4' && !info.internal && info.address && info.address !== '127.0.0.1') {
        if (info.address.startsWith('169.254.')) continue;
        let score = 0;
        const lowerName = name.toLowerCase();
        // High penalty for WSL / Hyper-V default switch / Docker / VM host-only
        if (
          lowerName.includes('wsl') ||
          lowerName.includes('default switch') ||
          lowerName.includes('docker') ||
          lowerName.includes('host-only')
        ) {
          score -= 50;
        }
        // Tailscale / VPN (valid fallback, but lower priority than local LAN)
        if (
          lowerName.includes('tailscale') ||
          lowerName.includes('zerotier') ||
          lowerName.includes('tun') ||
          lowerName.includes('tap')
        ) {
          score -= 20;
        }
        // Physical adapters
        if (
          lowerName.includes('wi-fi') ||
          lowerName.includes('wifi') ||
          lowerName.includes('wlan') ||
          lowerName.includes('ethernet') ||
          lowerName.includes('eth') ||
          lowerName.includes('en0') ||
          lowerName.includes('enp') ||
          lowerName.includes('eno')
        ) {
          score += 40;
        }
        // Preferred private LAN IP patterns
        if (info.address.startsWith('192.168.')) {
          score += 30;
        } else if (info.address.startsWith('10.')) {
          score += 20;
        } else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(info.address)) {
          score += 5;
        }
        list.push({ name, address: info.address, score });
      }
    }
  }

  list.sort((a, b) => b.score - a.score);
  return list[0]?.address || '127.0.0.1';
}

// Public network identification route for LAN helper and status bar
router.get('/network-info', (_req: Request, res: Response) => {
  try {
    const ip = getPrimaryLanIp();
    const interfaces = tunnelManager.getNetworkInterfaces();
    res.json({ ip, interfaces });
  } catch (err: any) {
    res.status(500).json({ error: err.message, ip: '127.0.0.1', interfaces: [] });
  }
});

// Authenticated system diagnostic routes
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
      lanIp: getPrimaryLanIp(),
      networkInterfaces: tunnelManager.getNetworkInterfaces(),
      timestamp: new Date().toISOString(),
    };

    res.json(systemInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
