export type AppTheme = 'cyberpunk' | 'dracula' | 'onedark' | 'monokai' | 'nord' | 'moba';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  primary: string;
  accent: string;
  bgDark: string;
  bgSurface: string;
  bgElevated: string;
  border: string;
  text: string;
  badge: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  authType: 'local' | 'sso';
  avatarUrl?: string;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  isLoading: boolean;
  error?: string | null;
}

export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent' | 'none';
  password?: string;
  keyId?: string;
  passphrase?: string;
  folder: string;
  tags: string[];
  colorTag?: string;
  icon?: string;
  isFavorite?: boolean;
  jumpHostId?: string;
  defaultPath?: string;
  startupCommand?: string;
  closeSessionOnExit?: boolean;
  keepaliveInterval?: number;
  terminalFont?: string;
  terminalFontSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  profileId?: string;
  profile?: Partial<ServerProfile>;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  isPinned?: boolean;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: number;
  lastActive: number;
  closeOnTabClose: boolean;
  splitPane?: 'horizontal' | 'vertical' | null;
  customTitle?: boolean;
  latencyMs?: number;
  initialCommand?: string;
}

export interface TerminalSplitState {
  mode: 'single' | 'horizontal' | 'vertical';
  primaryTabId: string | null;
  secondaryTabId: string | null;
  splitRatio: number; // default 0.5
}

export type TunnelType = 'bridge' | 'direct' | 'local' | 'remote' | 'socks5';
export type TunnelStatus = 'active' | 'stopped' | 'starting' | 'error';

export interface SSHTunnel {
  id: string;
  name: string;
  type: TunnelType;
  status: TunnelStatus;
  bindHost: string; // '0.0.0.0' | '127.0.0.1'
  bindPort: number;
  remoteHost: string;
  remotePort: number;
  sshProfileId?: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshKeyId?: string;
  jumpHostId?: string;
  autoStart?: boolean;
  activeClients: number;
  bytesIn: number;
  bytesOut: number;
  uptimeSeconds: number;
  startedAt?: string;
  errorMessage?: string;
}

export interface KeyVaultItem {
  id: string;
  name: string;
  type: 'ed25519' | 'rsa' | 'ecdsa' | 'imported';
  keyType?: string;
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  bits?: number;
  comment?: string;
  createdAt: string;
}

export interface SFTPFileItem {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifyTime: number;
  permissions: string; // e.g. "0755" or "drwxr-xr-x"
  owner?: string;
  group?: string;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  description?: string;
  category: string;
  tags: string[];
  autoExecute?: boolean;
  variables?: string[];
  createdAt: string;
}

export interface AppSettings {
  theme: AppTheme;
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  terminalSound: boolean;
  sftpPosition: 'left' | 'right' | 'sidebar';
  defaultCloseOnExit: boolean;
  defaultKeepalive: number;
  lanIp: string;
  copyOnSelect?: boolean;
  rightClickPaste?: boolean;
  confirmMultiLinePaste?: boolean;
}

export interface QuickConnectParams {
  host: string;
  port: number;
  username: string;
  password?: string;
  keyId?: string;
  saveAsProfile?: boolean;
  profileName?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  startDrag: (fileInfo: {
    path: string;
    name: string;
    isDirectory: boolean;
    profileId?: string;
  }) => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  openExternal: (url: string) => void;
  showItemInFolder: (fullPath: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
