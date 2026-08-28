import { ServerProfile, KeyVaultItem, SSHTunnel, Snippet, SFTPFileItem, User, LocalDriveInfo, QuickLocation, CrossTransferParams } from '../types';
import { storage } from './storage';

export type ProfileTarget = string | Partial<ServerProfile> | ServerProfile | undefined | null;

function appendSftpParams(params: URLSearchParams, target?: ProfileTarget): void {
  if (!target) return;
  if (typeof target === 'string') {
    if (target.trim()) params.set('profileId', target.trim());
    return;
  }
  if (target.id) params.set('profileId', target.id);
  if (target.host) params.set('host', target.host);
  if (target.port) params.set('port', String(target.port));
  if (target.username) params.set('username', target.username);
  if (target.password) params.set('password', target.password);
  if (target.keyId) params.set('keyId', target.keyId);
  if (target.jumpHostId) params.set('jumpHostId', target.jumpHostId);
  if (target.sftpCommand) params.set('sftpCommand', target.sftpCommand);
}

function getSftpBodyParams(target?: ProfileTarget): Record<string, any> {
  if (!target) return {};
  if (typeof target === 'string') {
    return target.trim() ? { profileId: target.trim() } : {};
  }
  const body: Record<string, any> = {};
  if (target.id) body.profileId = target.id;
  if (target.host) body.host = target.host;
  if (target.port) body.port = target.port;
  if (target.username) body.username = target.username;
  if (target.password) body.password = target.password;
  if (target.keyId) body.keyId = target.keyId;
  if (target.jumpHostId) body.jumpHostId = target.jumpHostId;
  if (target.sftpCommand) body.sftpCommand = target.sftpCommand;
  return body;
}

export function getApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001/api';
  if (window.location.protocol === 'file:' || !window.location.host) {
    return 'http://127.0.0.1:3001/api';
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3001/api';
  }
  return '/api';
}

class ApiClient {
  public get baseUrl(): string {
    return getApiBase();
  }

  private getHeaders(): HeadersInit {
    const token = storage.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Detect LAN IP helper
  async getLanIp(): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/system/network-info`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ip) return data.ip;
      }
    } catch {
      // Fallback
    }

    const customIp = storage.getSettings().lanIp;
    if (customIp && customIp !== '192.168.1.100') {
      return customIp;
    }

    return '127.0.0.1';
  }

  // Get full network info including detected LAN IP and all interfaces
  async getNetworkInfo(): Promise<{ ip: string; interfaces: any[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/system/network-info`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { ip: '127.0.0.1', interfaces: [] };
  }

  // --- Auth ---
  async login(credentials: { username: string; password: string }): Promise<{ user: User; token: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Invalid username or password');
    } catch (e: any) {
      if (e.message && (e.message.includes('fetch') || e.message === 'Failed to fetch')) {
        throw new Error('Unable to connect to NodeSSH authentication server. Please ensure the backend server is running on port 3001.');
      }
      throw e;
    }
  }

  async register(data: { username: string; email: string; password: string }): Promise<{ user: User; token: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Registration failed');
    } catch (e: any) {
      if (e.message && (e.message.includes('fetch') || e.message === 'Failed to fetch')) {
        throw new Error('Unable to connect to NodeSSH authentication server. Please ensure the backend server is running on port 3001.');
      }
      throw e;
    }
  }

  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/me`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return storage.getUser();
  }

  // --- Profiles ---
  async getProfiles(): Promise<ServerProfile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/profiles`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const serverProfiles = Array.isArray(data) ? data : [];
        const localProfiles = storage.getProfiles();

        // If server DB is empty but we have local storage profiles, migrate them to SQLite
        if (serverProfiles.length === 0 && localProfiles.length > 0) {
          console.log('[API] Auto-syncing existing local profiles to database...');
          const synced: ServerProfile[] = [];
          for (const p of localProfiles) {
            const saved = await this.saveProfile(p);
            synced.push(saved);
          }
          return synced;
        }

        storage.saveProfiles(serverProfiles);
        return serverProfiles;
      }
    } catch {}
    return storage.getProfiles();
  }

  async saveProfile(profile: ServerProfile): Promise<ServerProfile> {
    try {
      const isNew = !profile.id || profile.id.startsWith('temp-');
      const url = isNew ? `${this.baseUrl}/profiles` : `${this.baseUrl}/profiles/${profile.id}`;
      const method = isNew ? 'POST' : 'PUT';
      let res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(profile),
      });

      if (!res.ok && res.status === 404 && !isNew) {
        // Fallback to POST if server did not find profile ID
        res = await fetch(`${this.baseUrl}/profiles`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(profile),
        });
      }

      if (res.ok) {
        const saved = await res.json();
        const currentProfiles = storage.getProfiles();
        const idx = currentProfiles.findIndex(p => p.id === saved.id || (profile.id && p.id === profile.id));
        if (idx >= 0) {
          currentProfiles[idx] = saved;
        } else {
          currentProfiles.unshift(saved);
        }
        storage.saveProfiles(currentProfiles);
        return saved;
      }
    } catch {}

    // Offline storage fallback
    const profiles = storage.getProfiles();
    const existingIdx = profiles.findIndex(p => p.id === profile.id);
    if (existingIdx >= 0) {
      profiles[existingIdx] = profile;
    } else {
      if (!profile.id) profile.id = 'prof-' + Date.now();
      profiles.unshift(profile);
    }
    storage.saveProfiles(profiles);
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/profiles/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
    const profiles = storage.getProfiles().filter(p => p.id !== id);
    storage.saveProfiles(profiles);
  }

  // --- Key Vault ---
  async getKeys(): Promise<KeyVaultItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/keys`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const serverKeys: KeyVaultItem[] = (Array.isArray(data) ? data : []).map((k: any) => ({
          id: k.id || 'key-' + Date.now(),
          name: k.name || 'Unnamed Key',
          type: k.type || k.key_type || 'ed25519',
          keyType: k.key_type || k.type || 'ed25519',
          publicKey: k.publicKey || k.public_key || '',
          fingerprint: k.fingerprint || '',
          createdAt: k.createdAt || k.created_at || new Date().toISOString(),
          comment: k.comment,
        }));

        const localKeys = storage.getKeys();
        if (serverKeys.length === 0 && localKeys.length > 0) {
          console.log('[API] Auto-syncing existing local keys to vault database...');
          const synced: KeyVaultItem[] = [];
          for (const k of localKeys) {
            const saved = await this.saveKey(k);
            synced.push(saved);
          }
          return synced;
        }

        storage.saveKeys(serverKeys);
        return serverKeys;
      }
    } catch {}
    const local = storage.getKeys();
    return Array.isArray(local) ? local : [];
  }

  async saveKey(key: KeyVaultItem): Promise<KeyVaultItem> {
    try {
      const isNew = !key.id || key.id.startsWith('temp-');
      const url = isNew ? `${this.baseUrl}/keys` : `${this.baseUrl}/keys/${key.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(key),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const keys = storage.getKeys();
    const existingIdx = keys.findIndex(k => k.id === key.id);
    if (existingIdx >= 0) {
      keys[existingIdx] = key;
    } else {
      if (!key.id) key.id = 'key-' + Date.now();
      keys.push(key);
    }
    storage.saveKeys(keys);
    return key;
  }

  async deleteKey(id: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/keys/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
    const keys = storage.getKeys().filter(k => k.id !== id);
    storage.saveKeys(keys);
  }

  async pushKeyToServer(params: {
    host: string;
    port: number;
    username: string;
    password?: string;
    publicKey: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/keys/push-to-server`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          host: params.host,
          port: params.port,
          username: params.username,
          password: params.password,
          public_key: params.publicKey,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to push key to ${params.username}@${params.host}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable. Please ensure the server is running on port 3001.');
      }
      throw e;
    }
  }

  // --- Known Hosts ---
  async getKnownHosts(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/keys/known-hosts`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return [];
  }

  async trustHost(data: {
    host: string;
    port: number;
    keyType: string;
    fingerprint: string;
    publicKey?: string;
  }): Promise<{ success: boolean; host?: any }> {
    try {
      const res = await fetch(`${this.baseUrl}/keys/trust-host`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { success: true };
  }

  async deleteKnownHost(id: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/keys/known-hosts/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
  }

  // --- Tunnels ---
  async getTunnels(): Promise<SSHTunnel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/tunnels`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const serverTunnels = Array.isArray(data) ? data : [];
        const localTunnels = storage.getTunnels();
        if (serverTunnels.length === 0 && localTunnels.length > 0) {
          console.log('[API] Auto-syncing existing local tunnels to database...');
          const synced: SSHTunnel[] = [];
          for (const t of localTunnels) {
            const saved = await this.saveTunnel(t);
            synced.push(saved);
          }
          return synced;
        }
        storage.saveTunnels(serverTunnels);
        return serverTunnels;
      }
    } catch {}
    return storage.getTunnels();
  }

  async saveTunnel(tunnel: SSHTunnel): Promise<SSHTunnel> {
    try {
      const isNew = !tunnel.id || tunnel.id.startsWith('temp-') || tunnel.id.startsWith('tun-');
      const url = isNew ? `${this.baseUrl}/tunnels` : `${this.baseUrl}/tunnels/${tunnel.id}`;
      const method = isNew ? 'POST' : 'PUT';
      let res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(tunnel),
      });

      if (!res.ok && res.status === 404 && !isNew) {
        res = await fetch(`${this.baseUrl}/tunnels`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(tunnel),
        });
      }

      if (res.ok) {
        const saved = await res.json();
        const currentTunnels = storage.getTunnels();
        const idx = currentTunnels.findIndex(t => t.id === saved.id || (tunnel.id && t.id === tunnel.id));
        if (idx >= 0) {
          currentTunnels[idx] = saved;
        } else {
          currentTunnels.unshift(saved);
        }
        storage.saveTunnels(currentTunnels);
        return saved;
      }
    } catch {}

    const tunnels = storage.getTunnels();
    const existingIdx = tunnels.findIndex(t => t.id === tunnel.id);
    if (existingIdx >= 0) {
      tunnels[existingIdx] = tunnel;
    } else {
      if (!tunnel.id) tunnel.id = 'tun-' + Date.now();
      tunnels.unshift(tunnel);
    }
    storage.saveTunnels(tunnels);
    return tunnel;
  }

  async toggleTunnel(id: string, start: boolean): Promise<SSHTunnel> {
    const action = start ? 'start' : 'stop';
    try {
      const res = await fetch(`${this.baseUrl}/tunnels/${id}/${action}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const tunnels = storage.getTunnels();
        const idx = tunnels.findIndex(t => t.id === id);
        if (idx >= 0) {
          tunnels[idx] = data;
          storage.saveTunnels(tunnels);
        }
        return data;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to ${action} tunnel on server`);
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
    }

    // Offline simulation
    const tunnels = storage.getTunnels();
    const target = tunnels.find(t => t.id === id);
    if (target) {
      target.status = start ? 'active' : 'stopped';
      if (start) {
        target.startedAt = new Date().toISOString();
        target.activeClients = 1;
      } else {
        target.activeClients = 0;
      }
      storage.saveTunnels(tunnels);
      return { ...target };
    }
    throw new Error('Tunnel not found');
  }

  async deleteTunnel(id: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/tunnels/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
    const tunnels = storage.getTunnels().filter(t => t.id !== id);
    storage.saveTunnels(tunnels);
  }

  // --- Snippets ---
  async getSnippets(): Promise<Snippet[]> {
    try {
      const res = await fetch(`${this.baseUrl}/snippets`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const serverSnippets = Array.isArray(data) ? data : [];
        const localSnippets = storage.getSnippets();
        if (serverSnippets.length === 0 && localSnippets.length > 0) {
          console.log('[API] Auto-syncing existing local snippets to database...');
          const synced: Snippet[] = [];
          for (const s of localSnippets) {
            const saved = await this.saveSnippet(s);
            synced.push(saved);
          }
          return synced;
        }
        storage.saveSnippets(serverSnippets);
        return serverSnippets;
      }
    } catch {}
    return storage.getSnippets();
  }

  async saveSnippet(snippet: Snippet): Promise<Snippet> {
    try {
      const isNew = !snippet.id || snippet.id.startsWith('temp-');
      const url = isNew ? `${this.baseUrl}/snippets` : `${this.baseUrl}/snippets/${snippet.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(snippet),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const snippets = storage.getSnippets();
    const existingIdx = snippets.findIndex(s => s.id === snippet.id);
    if (existingIdx >= 0) {
      snippets[existingIdx] = snippet;
    } else {
      if (!snippet.id) snippet.id = 'snip-' + Date.now();
      snippets.push(snippet);
    }
    storage.saveSnippets(snippets);
    return snippet;
  }

  async deleteSnippet(id: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/snippets/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
    const snippets = storage.getSnippets().filter(s => s.id !== id);
    storage.saveSnippets(snippets);
  }

  // --- SFTP ---
  async listSftpFiles(path?: string, target?: ProfileTarget): Promise<SFTPFileItem[] & { resolvedPath?: string }> {
    try {
      const cleanPath = typeof path === 'string' ? path.trim() : '';
      const q = new URLSearchParams();
      if (cleanPath) q.set('path', cleanPath);
      appendSftpParams(q, target);
      const res = await fetch(`${this.baseUrl}/sftp/list?${q.toString()}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const rawItems = Array.isArray(data) ? data : data.items || [];
        const resolvedPath = data.path || cleanPath || '/';
        const items = rawItems.map((item: any) => ({
          name: item.filename || item.name,
          path: `${resolvedPath === '/' ? '' : resolvedPath.replace(/\/$/, '')}/${item.filename || item.name}`,
          type: item.isDirectory ? 'directory' : item.isSymbolicLink ? 'symlink' : 'file',
          size: item.size || 0,
          permissions: item.permissions || '0644',
          modifyTime: item.modifyTime ? (typeof item.modifyTime === 'number' ? item.modifyTime : new Date(item.modifyTime).getTime()) : Date.now(),
          owner: item.uid ? String(item.uid) : 'user',
        }));
        (items as any).resolvedPath = resolvedPath;
        return items as SFTPFileItem[] & { resolvedPath?: string };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to list directory: ${cleanPath || '.'}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable. Ensure the backend is running on port 3001.');
      }
      throw e;
    }
  }

  async readSftpFile(filePath: string, target?: ProfileTarget): Promise<string> {
    try {
      const q = new URLSearchParams({ path: filePath });
      appendSftpParams(q, target);
      const res = await fetch(`${this.baseUrl}/sftp/read?${q.toString()}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return json.content !== undefined ? json.content : text;
        } catch {
          return text;
        }
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to read remote file: ${filePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async writeSftpFile(filePath: string, content: string, target?: ProfileTarget): Promise<void> {
    try {
      const body = { path: filePath, content, ...getSftpBodyParams(target) };
      const res = await fetch(`${this.baseUrl}/sftp/write`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to write file to ${filePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async createSftpFolder(dirPath: string, target?: ProfileTarget): Promise<void> {
    try {
      const body = { path: dirPath, ...getSftpBodyParams(target) };
      const res = await fetch(`${this.baseUrl}/sftp/mkdir`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to create remote directory: ${dirPath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async chmodSftpFile(filePath: string, mode: string | number, target?: ProfileTarget): Promise<void> {
    try {
      const body = { path: filePath, mode, ...getSftpBodyParams(target) };
      const res = await fetch(`${this.baseUrl}/sftp/chmod`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to update permissions on ${filePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async deleteSftpFile(filePath: string, isDirectory: boolean = false, target?: ProfileTarget): Promise<void> {
    try {
      const body = { path: filePath, isDirectory, ...getSftpBodyParams(target) };
      const res = await fetch(`${this.baseUrl}/sftp/delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to delete ${filePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async getTransferStatus(transferId: string): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/sftp/transfer/status?transferId=${encodeURIComponent(transferId)}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }

  async downloadSftpWithProgress(
    remotePath: string,
    target?: ProfileTarget,
    isDirectory?: boolean,
    onProgress?: (
      percent: number,
      loaded: number,
      total: number,
      details?: {
        currentFile?: string;
        exploredFiles?: number;
        exploredDirs?: number;
        processedFiles?: number;
      }
    ) => void,
    signal?: AbortSignal
  ): Promise<Blob> {
    const transferId = 'xfer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const q = new URLSearchParams({ path: remotePath, transferId });
    appendSftpParams(q, target);

    const token = storage.getToken();

    let pollInterval: any = null;
    let latestDetails: {
      currentFile?: string;
      exploredFiles?: number;
      exploredDirs?: number;
      processedFiles?: number;
    } = {};

    const startPolling = () => {
      pollInterval = setInterval(async () => {
        if (signal?.aborted) return;
        const status = await this.getTransferStatus(transferId);
        if (status) {
          latestDetails = {
            currentFile: status.currentFile,
            exploredFiles: status.exploredFiles,
            exploredDirs: status.exploredDirs,
            processedFiles: status.processedFiles,
          };
          if (isDirectory && onProgress && status.percent !== undefined) {
            onProgress(
              status.percent,
              status.processedBytes || 0,
              status.totalBytes || 0,
              latestDetails
            );
          }
        }
      }, 250);
    };

    if (isDirectory) {
      startPolling();
    }

    try {
      const res = await fetch(`${this.baseUrl}/sftp/download?${q.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      });

      if (!res.ok) {
        let errText = 'Download failed';
        try {
          const errJson = await res.json();
          if (errJson.error) errText = errJson.error;
        } catch {}
        throw new Error(errText);
      }

      if (!res.body) {
        const blob = await res.blob();
        if (onProgress) onProgress(100, blob.size, blob.size, latestDetails);
        return blob;
      }

      const contentLength = res.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        if (signal?.aborted) {
          reader.cancel().catch(() => {});
          this.abortTransfer(transferId).catch(() => {});
          throw new DOMException('Download aborted', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          const percent = total > 0
            ? Math.min(99, Math.round((loaded / total) * 100))
            : (latestDetails.exploredFiles && latestDetails.exploredFiles > 0
                ? Math.min(99, Math.round(((latestDetails.processedFiles || 0) / latestDetails.exploredFiles) * 100))
                : 0);
          if (onProgress) onProgress(percent, loaded, total, latestDetails);
        }
      }

      if (onProgress) onProgress(100, loaded, total || loaded, latestDetails);
      const mimeType = isDirectory ? 'application/zip' : 'application/octet-stream';
      return new Blob(chunks as any[], { type: mimeType });
    } catch (e: any) {
      if (e.name === 'AbortError' || signal?.aborted) {
        this.abortTransfer(transferId).catch(() => {});
        throw new Error('Download aborted');
      }
      throw e;
    } finally {
      if (pollInterval) clearInterval(pollInterval);
    }
  }

  async uploadSftpFile(
    file: File,
    remoteDir: string,
    target?: ProfileTarget,
    onProgress?: (percent: number, loaded: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error('Upload aborted'));
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('remoteDir', remoteDir);
      if (target) {
        if (typeof target === 'string') {
          if (target.trim()) formData.append('profileId', target.trim());
        } else {
          if (target.id) formData.append('profileId', target.id);
          if (target.host) formData.append('host', target.host);
          if (target.port) formData.append('port', String(target.port));
          if (target.username) formData.append('username', target.username);
          if (target.password) formData.append('password', target.password);
          if (target.keyId) formData.append('keyId', target.keyId);
          if (target.jumpHostId) formData.append('jumpHostId', target.jumpHostId);
          if (target.sftpCommand) formData.append('sftpCommand', target.sftpCommand);
        }
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/sftp/upload`);

      const token = storage.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      const onAbortHandler = () => {
        xhr.abort();
      };

      if (signal) {
        signal.addEventListener('abort', onAbortHandler);
      }

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
            onProgress(percent, event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        if (signal) signal.removeEventListener('abort', onAbortHandler);
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100, file.size, file.size);
          resolve();
        } else {
          let errText = 'Upload failed';
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.error) errText = json.error;
          } catch {}
          reject(new Error(errText));
        }
      };

      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbortHandler);
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', onAbortHandler);
        reject(new Error('Upload aborted'));
      };

      xhr.send(formData);
    });
  }

  async remoteExtract(archivePath: string, targetDir?: string, target?: ProfileTarget): Promise<{ message: string }> {
    try {
      const body = { archivePath, targetDir, ...getSftpBodyParams(target) };
      const res = await fetch(`${this.baseUrl}/sftp/extract`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to extract archive: ${archivePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async remoteCompress(sourcePaths: string[], targetArchive: string, target?: ProfileTarget): Promise<{ message: string }> {
    try {
      const body = { sourcePaths, targetArchive, ...getSftpBodyParams(target) };
      const res = await fetch(`${this.baseUrl}/sftp/compress`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to compress files to: ${targetArchive}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async abortTransfer(transferId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sftp/transfer/abort`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ transferId }),
      });
    } catch {
      // Ignore network abort errors
    }
  }

  // --- Local Filesystem API ---
  async getLocalDrives(): Promise<{ drives: LocalDriveInfo[]; quickLocations: QuickLocation[]; homeDir: string; platform: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/local-files/drives`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { drives: [{ name: 'C:', path: 'C:\\', isDrive: true }], quickLocations: [], homeDir: '', platform: 'win32' };
  }

  async listLocalFiles(dirPath?: string): Promise<SFTPFileItem[] & { resolvedPath?: string }> {
    try {
      const cleanPath = typeof dirPath === 'string' ? dirPath.trim() : '';
      const q = new URLSearchParams();
      if (cleanPath) q.set('path', cleanPath);
      const res = await fetch(`${this.baseUrl}/local-files/list?${q.toString()}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const rawItems = Array.isArray(data) ? data : data.items || [];
        const resolvedPath = data.path || cleanPath || '';
        const items = rawItems.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size || 0,
          permissions: item.permissions || '0644',
          modifyTime: item.modifyTime ? (typeof item.modifyTime === 'number' ? item.modifyTime : new Date(item.modifyTime).getTime()) : Date.now(),
          owner: item.owner || 'local',
        }));
        (items as any).resolvedPath = resolvedPath;
        return items as SFTPFileItem[] & { resolvedPath?: string };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to list local directory: ${cleanPath || '.'}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async readLocalFile(filePath: string): Promise<string> {
    try {
      const q = new URLSearchParams({ path: filePath });
      const res = await fetch(`${this.baseUrl}/local-files/read?${q.toString()}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return json.content !== undefined ? json.content : text;
        } catch {
          return text;
        }
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to read local file: ${filePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async writeLocalFile(filePath: string, content: string): Promise<void> {
    try {
      const body = { path: filePath, content };
      const res = await fetch(`${this.baseUrl}/local-files/write`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to write local file: ${filePath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async createLocalFolder(dirPath: string): Promise<void> {
    try {
      const body = { path: dirPath };
      const res = await fetch(`${this.baseUrl}/local-files/mkdir`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to create local directory: ${dirPath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async deleteLocalFile(targetPath: string, isDirectory: boolean = false): Promise<void> {
    try {
      const body = { path: targetPath, isDirectory };
      const res = await fetch(`${this.baseUrl}/local-files/delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to delete local path: ${targetPath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  async renameLocalFile(oldPath: string, newPath: string): Promise<void> {
    try {
      const body = { oldPath, newPath };
      const res = await fetch(`${this.baseUrl}/local-files/rename`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to rename local path: ${oldPath}`);
    } catch (e: any) {
      if (e.message && e.message.includes('fetch')) {
        throw new Error('NodeSSH backend server is unreachable.');
      }
      throw e;
    }
  }

  // --- Cross-Session Transfer ---
  async transferCrossSession(
    params: CrossTransferParams,
    onProgress?: (percent: number, loaded: number, total: number, details?: any) => void,
    signal?: AbortSignal
  ): Promise<any> {
    const transferId = params.transferId || 'cross-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const body = { ...params, transferId };

    let pollInterval: any = null;
    let latestDetails: any = {};

    if (onProgress) {
      pollInterval = setInterval(async () => {
        if (signal?.aborted) return;
        const status = await this.getTransferStatus(transferId);
        if (status) {
          latestDetails = {
            currentFile: status.currentFile,
            exploredFiles: status.exploredFiles,
            exploredDirs: status.exploredDirs,
            processedFiles: status.processedFiles,
          };
          if (onProgress && status.percent !== undefined) {
            onProgress(status.percent, status.processedBytes || 0, status.totalBytes || 0, latestDetails);
          }
        }
      }, 250);
    }

    try {
      const res = await fetch(`${this.baseUrl}/sftp/transfer-cross`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        let errText = 'Transfer failed';
        try {
          const json = await res.json();
          if (json.error) errText = json.error;
        } catch {}
        throw new Error(errText);
      }

      if (onProgress) {
        onProgress(100, 0, 0, latestDetails);
      }
      return await res.json();
    } catch (e: any) {
      if (e.name === 'AbortError' || signal?.aborted) {
        this.abortTransfer(transferId).catch(() => {});
        throw new Error('Transfer aborted');
      }
      throw e;
    } finally {
      if (pollInterval) clearInterval(pollInterval);
    }
  }
}

export const api = new ApiClient();
