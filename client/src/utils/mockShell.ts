import { SFTPFileItem } from '../types';

export interface MockShellState {
  cwd: string;
  user: string;
  hostname: string;
  commandHistory: string[];
}

export const INITIAL_MOCK_FILES: SFTPFileItem[] = [
  { name: '..', path: '/home', type: 'directory', size: 4096, modifyTime: Date.now() - 3600000, permissions: '0755', owner: 'root', group: 'root' },
  { name: '.ssh', path: '/home/ubuntu/.ssh', type: 'directory', size: 4096, modifyTime: Date.now() - 7200000, permissions: '0700', owner: 'ubuntu', group: 'ubuntu' },
  { name: '.bashrc', path: '/home/ubuntu/.bashrc', type: 'file', size: 3771, modifyTime: Date.now() - 86400000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: '.profile', path: '/home/ubuntu/.profile', type: 'file', size: 807, modifyTime: Date.now() - 86400000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'docker-compose.yml', path: '/home/ubuntu/docker-compose.yml', type: 'file', size: 1420, modifyTime: Date.now() - 1200000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'nginx.conf', path: '/home/ubuntu/nginx.conf', type: 'file', size: 2890, modifyTime: Date.now() - 4500000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'deploy.sh', path: '/home/ubuntu/deploy.sh', type: 'file', size: 856, modifyTime: Date.now() - 900000, permissions: '0755', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'app.py', path: '/home/ubuntu/app.py', type: 'file', size: 4210, modifyTime: Date.now() - 600000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'package.json', path: '/home/ubuntu/package.json', type: 'file', size: 1120, modifyTime: Date.now() - 300000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'access.log', path: '/home/ubuntu/access.log', type: 'file', size: 145820, modifyTime: Date.now() - 100000, permissions: '0644', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'backup_2026.tar.gz', path: '/home/ubuntu/backup_2026.tar.gz', type: 'file', size: 8492000, modifyTime: Date.now() - 18000000, permissions: '0600', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'src', path: '/home/ubuntu/src', type: 'directory', size: 4096, modifyTime: Date.now() - 500000, permissions: '0755', owner: 'ubuntu', group: 'ubuntu' },
  { name: 'config', path: '/home/ubuntu/config', type: 'directory', size: 4096, modifyTime: Date.now() - 800000, permissions: '0755', owner: 'ubuntu', group: 'ubuntu' },
];

export const MOCK_FILE_CONTENTS: Record<string, string> = {
  '/home/ubuntu/docker-compose.yml': `version: '3.8'

services:
  app:
    image: node:20-alpine
    container_name: nodessh-production
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=nodessh-super-secret-key-2026
    volumes:
      - ./data:/app/data
    networks:
      - nodessh-net

networks:
  nodessh-net:
    driver: bridge
`,
  '/home/ubuntu/nginx.conf': `events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       80;
        server_name  localhost;

        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        location /ws/ {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
        }
    }
}
`,
  '/home/ubuntu/deploy.sh': `#!/usr/bin/env bash
set -e

echo "🚀 Starting NodeSSH Deployment..."
echo "[1/4] Pulling latest git repository changes..."
git pull origin main

echo "[2/4] Installing dependencies..."
npm install --production

echo "[3/4] Building production artifacts..."
npm run build

echo "[4/4] Restarting systemd service..."
sudo systemctl restart nodessh.service

echo "✅ NodeSSH deployed successfully! Listening on port 3000."
`,
  '/home/ubuntu/app.py': `import os
import sys
from datetime import datetime

def main():
    print(f"[{datetime.now().isoformat()}] Starting NodeSSH Microservice...")
    port = os.getenv("PORT", 8080)
    print(f"Server initialized on 0.0.0.0:{port}")

if __name__ == "__main__":
    main()
`,
  '/home/ubuntu/package.json': `{
  "name": "remote-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "dotenv": "^16.4.5"
  }
}
`,
  '/home/ubuntu/.bashrc': `# ~/.bashrc: executed by bash(1) for non-login shells.
export HISTCONTROL=ignoreboth
export HISTSIZE=1000
export HISTFILESIZE=2000
export PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '

alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
`,
  '/home/ubuntu/access.log': `192.168.1.102 - - [25/Aug/2026:12:30:14 +0000] "GET /api/status HTTP/1.1" 200 142 "-" "Mozilla/5.0"
192.168.1.105 - - [25/Aug/2026:12:30:15 +0000] "GET /ws/terminal HTTP/1.1" 101 0 "-" "NodeSSH/1.0"
192.168.1.110 - - [25/Aug/2026:12:31:02 +0000] "POST /api/tunnels/start HTTP/1.1" 200 84 "-" "NodeSSH/1.0"
`,
};

export class MockShell {
  private cwd: string = '/home/ubuntu';
  private user: string = 'ubuntu';
  private hostname: string = 'nodessh-srv01';
  private inputBuffer: string = '';

  constructor(user?: string, host?: string) {
    if (user) this.user = user;
    if (host) this.hostname = host.split('.')[0] || 'remote-host';
  }

  public getPrompt(): string {
    return `\x1b[1;32m${this.user}@${this.hostname}\x1b[0m:\x1b[1;34m${this.cwd}\x1b[0m$ `;
  }

  public getWelcomeBanner(): string {
    return `\x1b[1;36m
  _   _           _      ____ ____  _   _ 
 | \\ | | ___   __| | ___/ ___/ ___|| | | |
 |  \\| |/ _ \\ / _\` |/ _ \\___ \\___ \\| |_| |
 | |\\  | (_) | (_| |  __/___) |__) |  _  |
 |_| \\_|\\___/ \\__,_|\\___|____/____/|_| |_|
\x1b[0m
\x1b[90m--------------------------------------------------------\x1b[0m
\x1b[1;33mNodeSSH Interactive Web Shell Session\x1b[0m
\x1b[32mHost:\x1b[0m ${this.hostname}  |  \x1b[32mUser:\x1b[0m ${this.user}  |  \x1b[32mUptime:\x1b[0m 14 days, 3 hours
\x1b[32mOS:\x1b[0m Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-40-generic x86_64)
\x1b[90mType 'help' for available commands or execute any standard Linux command.\x1b[0m
\x1b[90m--------------------------------------------------------\x1b[0m\r\n\r\n${this.getPrompt()}`;
  }

  public handleInput(input: string): { output: string; newCwd?: string } {
    if (input === '\r') {
      const command = this.inputBuffer.trim();
      this.inputBuffer = '';
      const res = this.executeCommand(command);
      return {
        output: `\r\n${res.text}${res.suppressPrompt ? '' : this.getPrompt()}`,
        newCwd: this.cwd,
      };
    } else if (input === '\u007f' || input === '\b') {
      // Backspace
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        return { output: '\b \b' };
      }
      return { output: '' };
    } else if (input === '\u0003') {
      // Ctrl+C
      this.inputBuffer = '';
      return { output: `^C\r\n${this.getPrompt()}` };
    } else if (input === '\u000c') {
      // Ctrl+L (Clear)
      return { output: `\x1b[2J\x1b[H${this.getPrompt()}${this.inputBuffer}` };
    } else if (input.startsWith('\x1b')) {
      // Escape sequence / arrow keys ignored in simple mock
      return { output: '' };
    } else {
      this.inputBuffer += input;
      return { output: input };
    }
  }

  public executeCommand(rawCmd: string): { text: string; suppressPrompt?: boolean } {
    if (!rawCmd) return { text: '' };

    const parts = rawCmd.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return {
          text: `\x1b[1;36mAvailable Commands in Emulation Mode:\x1b[0m
  ls, ll, la       List directory contents
  cd <dir>         Change current working directory
  pwd              Print working directory
  cat <file>       Display file contents
  uname -a         Display system architecture and kernel info
  top, htop        Show simulated process manager snapshot
  df -h, free -m   Show disk & memory utilization
  docker ps        List active Docker containers
  ip a, ifconfig   Show network interfaces & LAN IP
  whoami, id       Show current user & UID
  clear            Clear terminal screen
  help             Show this help message\r\n\r\n`,
        };

      case 'clear':
        return { text: '\x1b[2J\x1b[H', suppressPrompt: false };

      case 'pwd':
        return { text: `${this.cwd}\r\n` };

      case 'whoami':
        return { text: `${this.user}\r\n` };

      case 'id':
        return { text: `uid=1000(${this.user}) gid=1000(${this.user}) groups=1000(${this.user}),4(adm),27(sudo),999(docker)\r\n` };

      case 'hostname':
        return { text: `${this.hostname}\r\n` };

      case 'uname':
        if (args.includes('-a') || args.length === 0) {
          return { text: `Linux ${this.hostname} 6.8.0-40-generic #40-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\r\n` };
        }
        return { text: `Linux\r\n` };

      case 'cd': {
        const target = args[0] || '/home/ubuntu';
        if (target === '..') {
          const segments = this.cwd.split('/').filter(Boolean);
          segments.pop();
          this.cwd = segments.length > 0 ? '/' + segments.join('/') : '/';
        } else if (target.startsWith('/')) {
          this.cwd = target;
        } else if (target === '~') {
          this.cwd = `/home/${this.user}`;
        } else {
          this.cwd = this.cwd === '/' ? `/${target}` : `${this.cwd}/${target}`;
        }
        return { text: '' };
      }

      case 'ls':
      case 'll':
      case 'la': {
        const isLong = cmd === 'll' || args.includes('-l') || args.includes('-la') || args.includes('-al');
        if (isLong) {
          let output = 'total 1488\r\n';
          for (const f of INITIAL_MOCK_FILES) {
            const dateStr = new Date(f.modifyTime).toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const color = f.type === 'directory' ? '\x1b[1;34m' : (f.permissions.includes('7') ? '\x1b[1;32m' : '\x1b[0m');
            output += `drwxr-xr-x 2 ${f.owner} ${f.group} ${String(f.size).padStart(8)} ${dateStr} ${color}${f.name}\x1b[0m\r\n`;
          }
          return { text: output };
        } else {
          const names = INITIAL_MOCK_FILES.map(f => {
            return f.type === 'directory' ? `\x1b[1;34m${f.name}\x1b[0m` : (f.permissions.includes('7') ? `\x1b[1;32m${f.name}\x1b[0m` : f.name);
          });
          return { text: `${names.join('  ')}\r\n` };
        }
      }

      case 'cat': {
        const file = args[0];
        if (!file) return { text: 'cat: missing file operand\r\n' };
        const fullPath = file.startsWith('/') ? file : `${this.cwd}/${file}`;
        const content = MOCK_FILE_CONTENTS[fullPath] || MOCK_FILE_CONTENTS[`/home/ubuntu/${file}`];
        if (content) {
          return { text: `${content.replace(/\n/g, '\r\n')}\r\n` };
        }
        return { text: `cat: ${file}: No such file or directory\r\n` };
      }

      case 'df':
        return {
          text: `Filesystem      Size  Used Avail Use% Mounted on
udev            7.8G     0  7.8G   0% /dev
tmpfs           1.6G  2.1M  1.6G   1% /run
/dev/sda1        98G   22G   72G  24% /
/dev/sda15      105M  6.1M   99M   6% /boot/efi
/dev/sdb1       500G  120G  380G  24% /data\r\n`,
        };

      case 'free':
        return {
          text: `               total        used        free      shared  buff/cache   available
Mem:           15920        4120        8930         310        2870       11490
Swap:           4096           0        4096\r\n`,
        };

      case 'top':
      case 'htop':
        return {
          text: `\x1b[1mtop - 12:35:42 up 14 days,  3:12,  2 users,  load average: 0.14, 0.08, 0.05\x1b[0m
Tasks: \x1b[1m184 total\x1b[0m,   1 running, 183 sleeping,   0 stopped,   0 zombie
%Cpu(s):  \x1b[1m1.2\x1b[0m us,  \x1b[1m0.4\x1b[0m sy,  0.0 ni, \x1b[1m98.4\x1b[0m id,  0.0 wa,  0.0 hi,  0.0 si
MiB Mem :  \x1b[1m15920.4\x1b[0m total,   \x1b[1m8930.1\x1b[0m free,   \x1b[1m4120.2\x1b[0m used,   2870.1 buff/cache
MiB Swap:   4096.0 total,   4096.0 free,      0.0 used.  11490.2 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
 1042 root      20   0 1420108 142850  45210 S   1.8   0.9  14:20.14 dockerd
 2840 ubuntu    20   0  892300 110240  32100 S   0.9   0.7   8:45.32 node
 1210 root      20   0  162400  18400  12100 S   0.3   0.1   2:12.80 sshd
 3012 ubuntu    20   0   24100   4800   3200 R   0.0   0.0   0:00.02 top\r\n`,
        };

      case 'docker':
        if (args[0] === 'ps') {
          return {
            text: `CONTAINER ID   IMAGE                COMMAND                  CREATED         STATUS         PORTS                    NAMES
a4f891b2c3d4   node:20-alpine       "docker-entrypoint.s…"   2 days ago      Up 2 days      0.0.0.0:3000->3000/tcp   nodessh-production
e91b2c3d4a5f   postgres:16-alpine   "docker-entrypoint.s…"   5 days ago      Up 5 days      0.0.0.0:5432->5432/tcp   postgres-db
7c8d9e0f1a2b   redis:7-alpine       "docker-entrypoint.s…"   2 weeks ago     Up 2 weeks     0.0.0.0:6379->6379/tcp   redis-cache\r\n`,
          };
        }
        return { text: `Docker version 27.1.1, build 6312585\r\n` };

      case 'ip':
        return {
          text: `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    inet 192.168.1.150/24 brd 192.168.1.255 scope global eth0
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0\r\n`,
        };

      case 'date':
        return { text: `${new Date().toUTCString()}\r\n` };

      case 'uptime':
        return { text: ` 12:35:42 up 14 days,  3:12,  2 users,  load average: 0.14, 0.08, 0.05\r\n` };

      default:
        return { text: `${cmd}: command executed (PID: ${Math.floor(1000 + Math.random() * 9000)})\r\n` };
    }
  }
}
