export type AuthType = 'password' | 'key' | 'agent' | 'none';
export type KeyType = 'ed25519' | 'rsa' | 'ecdsa';
export type TunnelType = 'bridge' | 'direct' | 'local' | 'remote' | 'socks5' | 'dynamic' | 'proxy' | 'tcp';
export type TunnelStatus = 'active' | 'stopped' | 'error';

export interface User {
  id: string;
  username: string;
  password_hash: string | null;
  email: string | null;
  sso_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string | null;
  sso_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  email?: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: AuthType;
  password?: string | null;
  key_id?: string | null;
  passphrase?: string | null;
  jump_host_id?: string | null;
  initial_dir?: string | null;
  startup_command?: string | null;
  keepalive_interval: number;
  close_on_exit: number; // 1 = true, 0 = false
  tags?: string | null; // JSON array string e.g. '["prod", "aws"]'
  group_name?: string | null;
  terminal_theme?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileCreateDTO {
  name: string;
  host: string;
  port?: number;
  username: string;
  auth_type: AuthType;
  password?: string;
  key_id?: string;
  passphrase?: string;
  jump_host_id?: string;
  initial_dir?: string;
  startup_command?: string;
  keepalive_interval?: number;
  close_on_exit?: boolean;
  tags?: string[] | string;
  group_name?: string;
  terminal_theme?: string;
}

export interface ProfileUpdateDTO extends Partial<ProfileCreateDTO> {}

export interface SSHKey {
  id: string;
  user_id: string;
  name: string;
  public_key: string;
  encrypted_private_key: string;
  key_type: KeyType;
  fingerprint: string;
  created_at: string;
}

export interface SSHKeyDTO {
  id: string;
  name: string;
  public_key: string;
  key_type: KeyType;
  fingerprint: string;
  created_at: string;
}

export interface SSHKeyGenerateDTO {
  name: string;
  key_type: KeyType;
  bits?: number; // 2048, 4096 (for RSA)
  comment?: string;
}

export interface SSHKeyPushDTO {
  key_id?: string;
  public_key?: string;
  host: string;
  port?: number;
  username: string;
  password?: string;
}

export interface Tunnel {
  id: string;
  user_id: string;
  profile_id: string;
  name: string;
  tunnel_type: TunnelType;
  bind_host: string;
  bind_port: number;
  dest_host?: string | null;
  dest_port?: number | null;
  auto_start: number; // 1 = true, 0 = false
  created_at: string;
}

export interface TunnelCreateDTO {
  profile_id: string;
  name: string;
  tunnel_type: TunnelType;
  bind_host?: string;
  bind_port: number;
  dest_host?: string;
  dest_port?: number;
  auto_start?: boolean;
}

export interface TunnelUpdateDTO extends Partial<TunnelCreateDTO> {}

export interface TunnelRuntimeMetrics {
  activeConnections: number;
  bytesSent: number;
  bytesReceived: number;
  uptimeSeconds: number;
  status: TunnelStatus;
  errorMessage?: string | null;
  startedAt?: string | null;
}

export interface ActiveTunnelInfo extends Tunnel {
  metrics: TunnelRuntimeMetrics;
}

export interface Snippet {
  id: string;
  user_id: string;
  title: string;
  command: string;
  category: string;
  description?: string | null;
  created_at: string;
}

export interface SnippetCreateDTO {
  title: string;
  command: string;
  category?: string;
  description?: string;
}

export interface SnippetUpdateDTO extends Partial<SnippetCreateDTO> {}

export interface UserSettings {
  id: string;
  user_id: string;
  preferences_json: string;
  updated_at: string;
}

export interface SFTPFileEntry {
  filename: string;
  longname?: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
  modifyTime: number;
  accessTime: number;
  permissions: string; // e.g. "rwxr-xr-x"
  mode: number; // octal e.g. 0o755
  uid: number;
  gid: number;
}

export interface SFTPStat {
  size: number;
  uid: number;
  gid: number;
  mode: number;
  atime: number;
  mtime: number;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  permissions: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

// WebSocket Terminal Protocol Messages
export interface WSTerminalInitMessage {
  type: 'init';
  profileId?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  keyId?: string;
  privateKey?: string;
  passphrase?: string;
  jumpHostId?: string;
  cols?: number;
  rows?: number;
  term?: string;
  close_on_exit?: boolean;
}

export interface WSTerminalDataMessage {
  type: 'data';
  data: string;
}

export interface WSTerminalResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export interface WSTerminalPingMessage {
  type: 'ping';
}

export type WSTerminalClientMessage =
  | WSTerminalInitMessage
  | WSTerminalDataMessage
  | WSTerminalResizeMessage
  | WSTerminalPingMessage;

export interface WSTerminalOutputMessage {
  type: 'data';
  data: string;
}

export interface WSTerminalStatusMessage {
  type: 'status';
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  message?: string;
}

export interface WSTerminalExitMessage {
  type: 'exit';
  code: number | null;
  signal: string | null;
}

export interface WSTerminalPongMessage {
  type: 'pong';
}

export interface WSTerminalErrorMessage {
  type: 'error';
  message: string;
}

export type WSTerminalServerMessage =
  | WSTerminalOutputMessage
  | WSTerminalStatusMessage
  | WSTerminalExitMessage
  | WSTerminalPongMessage
  | WSTerminalErrorMessage;
