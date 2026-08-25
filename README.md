# NodeSSH 🚀

> **The Modern, High-Performance Web-Based Alternative to MobaXterm**  
> Run locally on your workstation for zero-latency LAN port forwarding and SSH sessions, or deploy remotely in the cloud / Docker with multi-user isolation, encrypted key vaults, side-by-side SFTP file explorer, and KBS Cloud SSO.

---

## ✨ Key Features

### 🖥️ 1. Next-Gen Terminal (Powered by `@xterm/xterm` v5+)
- **Multi-Tab Interface & Split Panes**: Horizontal and vertical split-screen terminal views with drag/reorder tabs.
- **Configurable Session Kill on Tab Close**: Choose whether closing a tab immediately terminates the remote SSH process / PTY or keeps it detached in the background.
- **Multi-Exec / Broadcast Input Mode**: Send keystrokes or commands to all active SSH sessions simultaneously — perfect for multi-node server orchestration and cluster maintenance.
- **Rich Terminal Addons**: Auto-fit window resizing, search with highlight navigation, clickable web links, and 256-color & true-color rendering.
- **Theme Engine**: Cyberpunk Neon, Dracula, One Dark, Monokai, Nord, and MobaXterm Classic.

### 📁 2. Dockable Side-by-Side SFTP File Explorer
- **Synchronized SFTP Panel**: Live file manager alongside the active terminal tab.
- **Drag-and-Drop Uploads & Fast Downloads**: Upload files directly from your desktop or download remote assets with one click.
- **In-Browser Code & Config Editor**: Click any remote configuration file (`.conf`, `.sh`, `.json`, `.yaml`, `.py`, `.env`, etc.) to view and edit with syntax highlighting and instant Save back over SFTP.
- **Interactive Permissions Editor**: View and modify UNIX `chmod` octal permissions (e.g., `755`, `644`) with visual read/write/execute checkboxes.
- **Path Sync**: Quick button to jump the SFTP directory to the active terminal's current working directory.

### 🌐 3. Visual SSH Tunneling & Port Forwarding Manager
Solves the common challenge of tunneling connections across local networks and gateways:
- **Local Port Forwarding (`-L`)**:
  - Bind to `127.0.0.1` (localhost only) or `0.0.0.0` (all network interfaces).
  - **LAN Sharing**: When running NodeSSH locally and binding to `0.0.0.0`, any device on your local WiFi/Ethernet can connect to `http://<your-pc-ip>:<port>` and route through your SSH tunnel to remote servers/databases!
- **Remote Port Forwarding (`-R`)**: Forward connections from the remote SSH server back to a local target port.
- **Dynamic SOCKS5 Proxy (`-D`)**: Start an in-memory SOCKS5 proxy server locally, routing all browser/app traffic securely through the remote SSH tunnel.
- **Bastion / Jump Host (ProxyJump)**: Chained SSH hops to reach isolated private subnets.
- **Live Metrics Dashboard**: Real-time traffic counters (active client connections, bytes sent, bytes received, uptime) and 1-click start/stop.

### 🔐 4. Per-User AES-256 Encrypted SSH Key Vault
- **Encrypted Storage**: Private keys are securely encrypted at rest per user with AES-256-GCM.
- **In-Browser Key Generator**: Create Ed25519 and RSA 4096-bit keypairs with one click.
- **Key Importer**: Import OpenSSH, PEM, and PuTTY `.ppk` private keys.
- **1-Click Public Key Push (`ssh-copy-id`)**: Automatically authenticate with a password to push and install your public key into `~/.ssh/authorized_keys` with proper UNIX permissions.

### 👥 5. Multi-User Authentication & KBS Cloud SSO
- **Local Authentication**: Independent user accounts with `bcrypt` password hashing and JWT sessions.
- **KBS Cloud SSO Integration**: Native OAuth / SSO support via `https://github.com/kbs-cloud/shared` with automatic offline/local fallback.
- **Multi-Tenant Isolation**: Server profiles, encrypted keys, tunnels, snippets, and preferences are strictly isolated per user.

### ⚡ 6. Server Profiles & Snippet Library
- **Server Profile Manager**: Group servers into folders, assign color tags, configure jump hosts, custom keepalives, startup commands, and terminal settings.
- **Import / Export**: Full support for NodeSSH JSON backups and MobaXterm (`.mxtsessions` / `.ini`) session exports/imports.
- **Snippet Library**: Save commonly used commands and scripts for 1-click insertion or direct execution in the active terminal.

---

## 🏗️ Architecture Overview

```
NodeSSH/
├── server/                      # Node.js + TypeScript Backend
│   ├── src/
│   │   ├── auth/                # Local Auth (bcrypt + JWT) & KBS SSO
│   │   ├── db/                  # SQLite database engine & schema migrations
│   │   ├── ssh/                 # SSH2 manager, WebSocket PTY streamer, SFTP service
│   │   ├── tunnels/             # Tunnel engine (-L, -R, -D SOCKS5, JumpHost)
│   │   ├── routes/              # REST API controllers (profiles, keys, tunnels, snippets)
│   │   └── index.ts             # Express HTTP + WebSocket server
├── client/                      # React 18 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── terminal/        # @xterm/xterm tabs, split panes, multi-exec bar
│   │   │   ├── sftp/            # Dockable file explorer, code editor, permissions modal
│   │   │   ├── tunnels/         # Visual tunnel dashboard & LAN helper
│   │   │   ├── profiles/        # Profile manager, quick connect, MobaXterm importer
│   │   │   ├── keys/            # Key vault, key generator, ssh-copy-id modal
│   │   │   └── auth/            # Local Login/Register & KBS SSO panel
│   │   └── App.tsx              # Main application shell & state orchestration
└── package.json                 # Root coordination scripts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/NodeSSH.git
cd NodeSSH

# Install dependencies for root, server, and client
npm run install:all
```

### Development Mode

Start both the backend server (port `3001`) and the Vite React frontend (port `5173`) with live reload:

```bash
npm run dev
```

Open your browser to: **`http://localhost:5173`**

### Production Build & Standalone Server

Build the optimized React client and compile the TypeScript backend into a single standalone server:

```bash
# Build frontend and backend
npm run build

# Start production server (serves web UI, API, and WebSockets on port 3000)
npm start
```

Access the standalone app at: **`http://localhost:3000`**

---

## 🔧 Configuration Options

Environment variables can be specified in a `.env` file in the `server/` directory:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` (dev) / `3000` (prod) | HTTP & WebSocket listening port |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` allows LAN access, `127.0.0.1` for local only) |
| `JWT_SECRET` | `nodessh-secret-jwt-key` | Secret key for signing user session tokens |
| `VAULT_ENCRYPTION_KEY` | `nodessh-vault-master-key-32-byte` | Master key for AES-256-GCM key vault encryption |
| `DB_TYPE` | `sqlite` | Database engine: `sqlite` or `mongodb` |
| `DB_PATH` | `server/data/nodessh.db` | Location of the SQLite database file (when `DB_TYPE=sqlite`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/nodessh` | MongoDB connection URI (when `DB_TYPE=mongodb`) |
| `KBS_SSO_CLIENT_ID` | `nodessh` | Client ID for KBS Cloud SSO authentication |

---

## 🛡️ Security

- **Encryption at Rest**: SSH private keys stored in the database are encrypted using AES-256-GCM with unique initialization vectors (IV) and authentication tags.
- **Session Tokens**: REST API endpoints and WebSocket handshakes require valid JWT tokens.
- **No Plaintext Passwords**: User passwords are saved as salted hashes using `bcrypt`.
- **Granular Session Teardown**: Closing an SSH tab immediately sends a graceful termination signal to the remote PTY and cleans up memory and open sockets.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
