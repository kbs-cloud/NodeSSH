# NodeSSH 🚀

> **The Modern, High-Performance Web & Desktop Alternative to MobaXterm**  
> Run as a standalone cross-platform **Electron Desktop App** or deploy as a **Web Service / Docker container** for zero-latency LAN port forwarding and SSH sessions. Features user session isolation, AES-256 encrypted key vaults, a side-by-side SFTP file explorer with direct downloads, and interactive terminal split panes.

---

## ✨ Key Features

### 🖥️ 1. Next-Gen Terminal (Powered by `@xterm/xterm` v6+)
- **Multi-Tab Interface & Resizable Split Panes**: Horizontal and vertical split-screen terminal views with interactive draggable splitter bars (and double-click 50/50 reset) and drag/reorder tabs.
- **Configurable Session Kill on Tab Close**: Choose whether closing a tab immediately terminates the remote SSH process / PTY or keeps it detached in the background.
- **Multi-Exec / Broadcast Input Mode**: Send keystrokes or commands to all active SSH sessions simultaneously — perfect for multi-node server orchestration and cluster maintenance.
- **Safe Multi-Line Paste Confirmation**: Intercepts multi-line pastes with newline characters, giving you a preview modal before execution to prevent accidental commands.
- **Rich Terminal Addons**: Auto-fit window resizing, search with highlight navigation, clickable web links, and 256-color & true-color rendering.
- **Theme Engine**: Cyberpunk Neon, Dracula, One Dark, Monokai, Nord, and MobaXterm Classic.

### 📁 2. Dockable Side-by-Side SFTP File Explorer
- **Resizable Dock Windows**: Drag-to-resize divider gutter on left or right docked SFTP explorer with automatic preference persistence.
- **Left-Aligned Quick Action Column**: Action buttons (More Options, Download, Edit) positioned on the left side of every row for instant access without horizontal scrolling.
- **Synchronized SFTP Panel**: Live file manager alongside the active terminal tab with automatic per-tab directory tracking.
- **OS-Native Drag-and-Drop (Desktop Mode)**: Drag remote files or entire directories directly from the SFTP tree onto your local Desktop or OS File Explorer. Directories are automatically staged and extracted.
- **Drag-and-Drop Web Uploads & Fast Downloads**: Upload files directly from your desktop or download remote assets with one click.
- **In-Browser Code & Config Editor**: Click any remote configuration file (`.conf`, `.sh`, `.json`, `.yaml`, `.py`, `.env`, etc.) to view and edit with syntax highlighting and instant Save back over SFTP.
- **Interactive Permissions Editor**: View and modify UNIX `chmod` octal permissions (e.g., `755`, `644`) with visual read/write/execute checkboxes.
- **Path Sync**: Quick button to jump the SFTP directory to the active terminal's current working directory.
- **Transfer Progress**: Real-time progress banners for active uploads and downloads.

### 💻 3. Cross-Platform Electron Desktop Application
- **Frameless Cyberpunk UI**: Sleek, custom borderless window frame with integrated Minimize, Maximize/Restore, and Close controls.
- **Self-Contained Lifecycle**: Automatically boots and manages the embedded background backend server process on launch.
- **Native OS Shell Integration**: Direct deep linking, external browser opening, and local folder inspection.

### 🌐 4. Visual SSH Tunneling & Port Forwarding Manager
Solves the common challenge of tunneling connections across local networks and gateways:
- **Local Port Forwarding (`-L`)**:
  - Bind to `127.0.0.1` (localhost only) or `0.0.0.0` (all network interfaces).
  - **LAN Sharing**: When running NodeSSH locally and binding to `0.0.0.0`, any device on your local WiFi/Ethernet can connect to `http://<your-pc-ip>:<port>` and route through your SSH tunnel to remote servers/databases!
- **Remote Port Forwarding (`-R`)**: Forward connections from the remote SSH server back to a local target port.
- **Dynamic SOCKS5 Proxy (`-D`)**: Start an in-memory SOCKS5 proxy server locally, routing all browser/app traffic securely through the remote SSH tunnel.
- **Bastion / Jump Host (ProxyJump)**: Chained SSH hops to reach isolated private subnets.
- **Live Metrics Dashboard**: Real-time traffic counters (active client connections, bytes sent, bytes received, uptime) and 1-click start/stop.

### 🔐 5. Per-User AES-256 Encrypted SSH Key Vault & Security
- **Encrypted Storage**: Private keys are securely encrypted at rest per user with AES-256-GCM.
- **Drag-and-Drop Key Import**: Drag any private key file (`.pem`, `.ppk`, `id_rsa`, `id_ed25519`, `.key`, `.pub`) directly from your desktop or file manager into the Key Vault for instant type detection and import.
- **Host Key Verification (TOFU)**: Trust-On-First-Use fingerprint verification modal and known-hosts database to prevent Man-In-The-Middle attacks.
- **In-Browser Key Generator**: Create Ed25519 and RSA 4096-bit keypairs with one click.
- **Key Importer**: Import OpenSSH, PEM, and PuTTY `.ppk` private keys with automatic format detection.
- **1-Click Public Key Push (`ssh-copy-id`)**: Automatically authenticate with a password to push and install your public key into `~/.ssh/authorized_keys` with proper UNIX permissions.

### 👥 6. User Authentication & Persistent Storage
- **Automatic Multi-Tier Data Persistence**: Profiles, encrypted keys, tunnels, snippets, and settings persist automatically to SQLite in `%APPDATA%\NodeSSH\data\nodessh.db` with local cache fallback and automatic two-way synchronization.
- **Local Authentication**: Independent user accounts with `bcrypt` password hashing and JWT sessions.
- **User Isolation**: Server profiles, encrypted keys, tunnels, snippets, and preferences are strictly isolated per user.

### ⚡ 7. Server Profiles & Snippet Library
- **Server Profile Manager**: Group servers into folders, assign color tags, configure jump hosts, custom keepalives, startup commands, and terminal settings.
- **Inline Connection Fallback**: Connect directly via quick-connect or saved credentials with automatic database record resolution.
- **Import / Export**: Full support for NodeSSH JSON backups and MobaXterm (`.mxtsessions` / `.ini`) session exports/imports.
- **Snippet Library**: Save commonly used commands and scripts for 1-click insertion or direct execution in the active terminal.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> | Open New Session / Connection Launcher |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Toggle Multi-Exec Broadcast Mode |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | Toggle Dockable SFTP File Explorer |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | Toggle Navigation Sidebar |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close Active Terminal Tab |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> .. <kbd>9</kbd> | Switch to Terminal Tab 1 through 9 |

---

## 🏗️ Architecture Overview

```
NodeSSH/
├── src/
│   ├── main/                    # Electron Main process & in-process backend
│   │   ├── index.ts             # Main entry: Window lifecycle, in-process server initialization
│   │   ├── ipc/                 # Electron IPC handlers (window controls, shell, downloads)
│   │   └── server/              # Embedded backend engine (Express + WebSockets + SSH2 + SQLite)
│   │       ├── auth/            # Local Auth (bcrypt + JWT)
│   │       ├── db/              # SQLite database engine & schema migrations
│   │       ├── ssh/             # SSH2 manager, WebSocket PTY streamer, SFTP service
│   │       ├── tunnels/         # Tunnel engine (-L, -R, -D SOCKS5, JumpHost)
│   │       ├── routes/          # REST API controllers (profiles, keys, tunnels, snippets, system)
│   │       ├── ws/              # WebSocket terminal & SFTP handlers
│   │       └── index.ts         # In-process server start/stop lifecycle
│   ├── preload/                 # Electron Preload Bridge
│   │   └── index.ts             # Secure contextBridge exposing window.electronAPI
│   └── renderer/                # React 19 + Vite + Tailwind CSS Frontend UI
│       ├── index.html           # HTML entry
│       └── src/
│           ├── components/      # Terminal tabs, split panes, SFTP, tunnels, profiles, key vault
│           ├── services/        # ApiClient & Terminal WebSocket session managers
│           └── App.tsx          # Application shell & state orchestration
├── tsconfig.main.json           # Main & Preload TypeScript configuration
├── vite.config.ts               # Root Vite configuration (bundles src/renderer to dist/renderer)
└── package.json                 # Unified dependencies & scripts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/kbs-cloud/NodeSSH.git
cd NodeSSH

# Install dependencies
npm install --legacy-peer-deps
```

---

### 🖥️ Running NodeSSH (Electron Desktop)

```bash
# Start Vite and launch Electron with live reload:
npm run dev

# Build both Renderer and Main processes:
npm run build

# Start the compiled production app:
npm start

# Run the backend test suite:
npm test
```

---

### 📦 Packaging & Distribution (Electron Builder)

```bash
# Package the application for the current platform:
npm run dist

# Package without creating an installer (unpacked directory only):
npm run dist:dir

# Package targeting specific platforms:
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

---

## 🔧 Configuration Options

Environment variables can be optionally configured via `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` (dev) / `3000` (prod) | HTTP & WebSocket listening port |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` allows LAN access, `127.0.0.1` for local only) |
| `JWT_SECRET` | `nodessh-secret-jwt-key` | Secret key for signing user session tokens |
| `VAULT_ENCRYPTION_KEY` | `nodessh-vault-master-key-32-byte` | Master key for AES-256-GCM key vault encryption |
| `DB_TYPE` | `sqlite` | Database engine: `sqlite` or `mongodb` |
| `DB_PATH` | `server/data/nodessh.db` | Location of the SQLite database file (when `DB_TYPE=sqlite`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/nodessh` | MongoDB connection URI (when `DB_TYPE=mongodb`) |

---

## 🛡️ Security

- **Host Key Verification**: Validates remote host public key fingerprints on first connection (TOFU) and persists known hosts to prevent MITM tampering.
- **Encryption at Rest**: SSH private keys stored in the database are encrypted using AES-256-GCM with unique initialization vectors (IV) and authentication tags.
- **Session Tokens**: REST API endpoints and WebSocket handshakes require valid JWT tokens.
- **No Plaintext Passwords**: User passwords are saved as salted hashes using `bcrypt`.
- **Granular Session Teardown**: Closing an SSH tab immediately sends a graceful termination signal to the remote PTY and cleans up memory and open sockets.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
