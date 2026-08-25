import { ServerProfile, KeyVaultItem, SSHTunnel, Snippet, AppSettings, User } from '../types';

const STORAGE_KEYS = {
  PROFILES: 'nodessh_profiles',
  KEYS: 'nodessh_keys',
  TUNNELS: 'nodessh_tunnels',
  SNIPPETS: 'nodessh_snippets',
  SETTINGS: 'nodessh_settings',
  AUTH_TOKEN: 'nodessh_token',
  AUTH_USER: 'nodessh_user',
};

export const DEFAULT_PROFILES: ServerProfile[] = [
  {
    id: 'prof-1',
    name: 'Production Web (Ubuntu 24.04)',
    host: '192.168.1.150',
    port: 22,
    username: 'ubuntu',
    authType: 'key',
    keyId: 'key-1',
    folder: 'Production',
    tags: ['Web', 'Nginx', 'Docker'],
    colorTag: '#00f0ff',
    icon: 'server',
    isFavorite: true,
    defaultPath: '/var/www/html',
    startupCommand: 'df -h && docker ps',
    closeSessionOnExit: true,
    keepaliveInterval: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prof-2',
    name: 'PostgreSQL Database Cluster',
    host: '10.0.4.20',
    port: 22,
    username: 'postgres',
    authType: 'key',
    keyId: 'key-1',
    jumpHostId: 'prof-1',
    folder: 'Production',
    tags: ['Database', 'Postgres', 'Internal'],
    colorTag: '#3b82f6',
    icon: 'database',
    isFavorite: true,
    defaultPath: '/var/lib/postgresql',
    closeSessionOnExit: true,
    keepaliveInterval: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prof-3',
    name: 'HomeLab Raspberry Pi 5',
    host: '192.168.1.200',
    port: 22,
    username: 'pi',
    authType: 'password',
    folder: 'HomeLab',
    tags: ['ARM64', 'HomeAssistant', 'Zigbee'],
    colorTag: '#10b981',
    icon: 'cpu',
    isFavorite: false,
    defaultPath: '/home/pi',
    closeSessionOnExit: true,
    keepaliveInterval: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prof-4',
    name: 'AWS Cloud Bastion Gateway',
    host: 'bastion.cloud.internal',
    port: 2222,
    username: 'ec2-user',
    authType: 'key',
    keyId: 'key-2',
    folder: 'AWS Cloud',
    tags: ['Bastion', 'Security', 'JumpHost'],
    colorTag: '#f59e0b',
    icon: 'shield',
    isFavorite: false,
    defaultPath: '/home/ec2-user',
    closeSessionOnExit: true,
    keepaliveInterval: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_KEYS: KeyVaultItem[] = [
  {
    id: 'key-1',
    name: 'Production Master Ed25519',
    type: 'ed25519',
    publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOrH8b/4f3x7n5k1a8m9p0q2w3e4r5t6y7u8i9o0 nodessh-prod-master@vault',
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACDqH/G/m0j/c7O59114tN4Xn6K3w+s8x7U8/G9g1kZqZwAAAJjGjL9uxoy/\nbgAAAAtzc2gtZWQyNTUxOQAAACDqH/G/m0j/c7O59114tN4Xn6K3w+s8x7U8/G9g1kZqZw\nAAAECjT280uD82/m4+44JkU0x6F4b8c9d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9\nw0x1y2z3a4b5c6d7e8f9====\n-----END OPENSSH PRIVATE KEY-----',
    fingerprint: 'SHA256:8yE7wU2+P9mN1qRv4xZ8kL3vW7jA5bC6dE9fG0hI1jK',
    comment: 'nodessh-prod-master@vault',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'key-2',
    name: 'AWS Cloud Infrastructure RSA 4096',
    type: 'rsa',
    bits: 4096,
    publicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDG8w1... nodessh-aws@vault',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAxvMN4P... [ENCRYPTED VAULT STORAGE] ...\n-----END RSA PRIVATE KEY-----',
    fingerprint: 'SHA256:d8K3mP9nL1xQ5wZ7yT0vB2aE4gH6jJ8lN3qS5uW7xY9',
    comment: 'nodessh-aws@vault',
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_TUNNELS: SSHTunnel[] = [
  {
    id: 'tun-1',
    name: 'Postgres DB (LAN Shared 0.0.0.0:5433 -> 5432)',
    type: 'local',
    status: 'active',
    bindHost: '0.0.0.0',
    bindPort: 5433,
    remoteHost: '10.0.4.20',
    remotePort: 5432,
    sshProfileId: 'prof-1',
    sshHost: '192.168.1.150',
    sshPort: 22,
    sshUser: 'ubuntu',
    sshKeyId: 'key-1',
    autoStart: true,
    activeClients: 3,
    bytesIn: 4820150,
    bytesOut: 12948200,
    uptimeSeconds: 8420,
    startedAt: new Date(Date.now() - 8420000).toISOString(),
  },
  {
    id: 'tun-2',
    name: 'Remote Webhook Ingress (Remote -R 8080 -> Local 3000)',
    type: 'remote',
    status: 'stopped',
    bindHost: '127.0.0.1',
    bindPort: 3000,
    remoteHost: '127.0.0.1',
    remotePort: 8080,
    sshProfileId: 'prof-1',
    sshHost: '192.168.1.150',
    sshPort: 22,
    sshUser: 'ubuntu',
    autoStart: false,
    activeClients: 0,
    bytesIn: 0,
    bytesOut: 0,
    uptimeSeconds: 0,
  },
  {
    id: 'tun-3',
    name: 'Dynamic SOCKS5 Proxy (Port 1080 for Browser/LAN)',
    type: 'socks5',
    status: 'active',
    bindHost: '0.0.0.0',
    bindPort: 1080,
    remoteHost: 'dynamic',
    remotePort: 0,
    sshProfileId: 'prof-4',
    sshHost: 'bastion.cloud.internal',
    sshPort: 2222,
    sshUser: 'ec2-user',
    autoStart: true,
    activeClients: 1,
    bytesIn: 18450900,
    bytesOut: 4590200,
    uptimeSeconds: 12540,
    startedAt: new Date(Date.now() - 12540000).toISOString(),
  },
];

export const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 'snip-1',
    name: 'Docker Status & Resource Usage',
    command: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" && docker stats --no-stream',
    description: 'Lists all running containers with port mappings and CPU/memory stats',
    category: 'Docker',
    tags: ['Docker', 'Monitoring', 'Containers'],
    autoExecute: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'snip-2',
    name: 'System Health Check & Disk Usage',
    command: 'echo "=== SYSTEM UPTIME & LOAD ===" && uptime && echo "=== MEMORY ===" && free -h && echo "=== DISK ===" && df -h -x tmpfs -x devtmpfs',
    description: 'Instant overview of server health, load average, RAM and disk usage',
    category: 'SysAdmin',
    tags: ['SysAdmin', 'Health', 'Disk', 'RAM'],
    autoExecute: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'snip-3',
    name: 'Find Large Files (>100MB)',
    command: 'find / -xdev -type f -size +100M -exec ls -lh {} + 2>/dev/null | awk \'{ print $9 ": " $5 }\'',
    description: 'Scans filesystem to locate files taking over 100MB of storage',
    category: 'SysAdmin',
    tags: ['Disk', 'Cleanup', 'Storage'],
    autoExecute: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'snip-4',
    name: 'Active Network Listening Ports',
    command: 'ss -tulpn | grep LISTEN',
    description: 'Displays all TCP/UDP sockets currently open and listening for connections',
    category: 'Network',
    tags: ['Network', 'Ports', 'Firewall'],
    autoExecute: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'snip-5',
    name: 'Restart Nginx & Check Syntax',
    command: 'sudo nginx -t && sudo systemctl reload nginx && sudo systemctl status nginx --no-pager',
    description: 'Tests nginx config validity before applying graceful reload',
    category: 'Web',
    tags: ['Nginx', 'Web', 'Reload'],
    autoExecute: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'snip-6',
    name: 'Tail Live Auth & System Logs',
    command: 'sudo journalctl -f -u sshd -u nodessh --lines=50',
    description: 'Follows SSH and application daemon log entries in real time',
    category: 'Logs',
    tags: ['Logs', 'SSH', 'Journalctl'],
    autoExecute: true,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'cyberpunk',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  cursorStyle: 'block',
  cursorBlink: true,
  terminalSound: false,
  sftpPosition: 'right',
  defaultCloseOnExit: true,
  defaultKeepalive: 30,
  lanIp: '192.168.1.100',
};

class StorageService {
  // Profiles
  getProfiles(): ServerProfile[] {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
    if (!data) {
      this.saveProfiles(DEFAULT_PROFILES);
      return DEFAULT_PROFILES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_PROFILES;
    }
  }

  saveProfiles(profiles: ServerProfile[]): void {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // Keys
  getKeys(): KeyVaultItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.KEYS);
    if (!data) {
      this.saveKeys(DEFAULT_KEYS);
      return DEFAULT_KEYS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_KEYS;
    }
  }

  saveKeys(keys: KeyVaultItem[]): void {
    localStorage.setItem(STORAGE_KEYS.KEYS, JSON.stringify(keys));
  }

  // Tunnels
  getTunnels(): SSHTunnel[] {
    const data = localStorage.getItem(STORAGE_KEYS.TUNNELS);
    if (!data) {
      this.saveTunnels(DEFAULT_TUNNELS);
      return DEFAULT_TUNNELS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_TUNNELS;
    }
  }

  saveTunnels(tunnels: SSHTunnel[]): void {
    localStorage.setItem(STORAGE_KEYS.TUNNELS, JSON.stringify(tunnels));
  }

  // Snippets
  getSnippets(): Snippet[] {
    const data = localStorage.getItem(STORAGE_KEYS.SNIPPETS);
    if (!data) {
      this.saveSnippets(DEFAULT_SNIPPETS);
      return DEFAULT_SNIPPETS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_SNIPPETS;
    }
  }

  saveSnippets(snippets: Snippet[]): void {
    localStorage.setItem(STORAGE_KEYS.SNIPPETS, JSON.stringify(snippets));
  }

  // Settings
  getSettings(): AppSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Auth
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  }

  getUser(): User | null {
    const data = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  setUser(user: User | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  }
}

export const storage = new StorageService();
