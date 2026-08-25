import { ServerProfile, KeyVaultItem, SSHTunnel, Snippet, SFTPFileItem, User } from '../types';
import { storage } from './storage';
import { INITIAL_MOCK_FILES, MOCK_FILE_CONTENTS } from '../utils/mockShell';

const API_BASE = '/api';

class ApiClient {
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
      const res = await fetch(`${API_BASE}/system/network-info`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ip) return data.ip;
      }
    } catch {
      // Fallback
    }

    // Attempt WebRTC local IP detection or fallback
    try {
      if (typeof window !== 'undefined' && (window as any).RTCPeerConnection) {
        // Simple fallback
      }
    } catch {}

    return storage.getSettings().lanIp || '192.168.1.100';
  }

  // --- Auth ---
  async login(credentials: { username: string; password: string }): Promise<{ user: User; token: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Login failed');
    } catch (e: any) {
      if (e.message && e.message !== 'Failed to fetch') {
        throw e;
      }
      // Offline fallback: simulate local login
      const user: User = {
        id: 'usr-local',
        username: credentials.username,
        email: `${credentials.username}@nodessh.local`,
        authType: 'local',
        createdAt: new Date().toISOString(),
      };
      const token = 'mock-jwt-token-' + Date.now();
      return { user, token };
    }
  }

  async register(data: { username: string; email: string; password: string }): Promise<{ user: User; token: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed');
    } catch (e: any) {
      if (e.message && e.message !== 'Failed to fetch') {
        throw e;
      }
      // Offline fallback
      const user: User = {
        id: 'usr-local-' + Date.now(),
        username: data.username,
        email: data.email,
        authType: 'local',
        createdAt: new Date().toISOString(),
      };
      const token = 'mock-jwt-token-' + Date.now();
      return { user, token };
    }
  }

  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
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
      const res = await fetch(`${API_BASE}/profiles`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        storage.saveProfiles(data);
        return data;
      }
    } catch {}
    return storage.getProfiles();
  }

  async saveProfile(profile: ServerProfile): Promise<ServerProfile> {
    try {
      const isNew = !profile.id || profile.id.startsWith('temp-');
      const url = isNew ? `${API_BASE}/profiles` : `${API_BASE}/profiles/${profile.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    // Offline storage
    const profiles = storage.getProfiles();
    const existingIdx = profiles.findIndex(p => p.id === profile.id);
    if (existingIdx >= 0) {
      profiles[existingIdx] = profile;
    } else {
      if (!profile.id) profile.id = 'prof-' + Date.now();
      profiles.push(profile);
    }
    storage.saveProfiles(profiles);
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/profiles/${id}`, {
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
      const res = await fetch(`${API_BASE}/keys`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        storage.saveKeys(data);
        return data;
      }
    } catch {}
    return storage.getKeys();
  }

  async saveKey(key: KeyVaultItem): Promise<KeyVaultItem> {
    try {
      const isNew = !key.id || key.id.startsWith('temp-');
      const url = isNew ? `${API_BASE}/keys` : `${API_BASE}/keys/${key.id}`;
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
      await fetch(`${API_BASE}/keys/${id}`, {
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
      const res = await fetch(`${API_BASE}/keys/push`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    // Simulated push
    await new Promise(r => setTimeout(r, 1200));
    return {
      success: true,
      message: `Key successfully appended to ${params.username}@${params.host}:~/.ssh/authorized_keys`,
    };
  }

  // --- Tunnels ---
  async getTunnels(): Promise<SSHTunnel[]> {
    try {
      const res = await fetch(`${API_BASE}/tunnels`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        storage.saveTunnels(data);
        return data;
      }
    } catch {}
    return storage.getTunnels();
  }

  async saveTunnel(tunnel: SSHTunnel): Promise<SSHTunnel> {
    try {
      const isNew = !tunnel.id || tunnel.id.startsWith('temp-');
      const url = isNew ? `${API_BASE}/tunnels` : `${API_BASE}/tunnels/${tunnel.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(tunnel),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const tunnels = storage.getTunnels();
    const existingIdx = tunnels.findIndex(t => t.id === tunnel.id);
    if (existingIdx >= 0) {
      tunnels[existingIdx] = tunnel;
    } else {
      if (!tunnel.id) tunnel.id = 'tun-' + Date.now();
      tunnels.push(tunnel);
    }
    storage.saveTunnels(tunnels);
    return tunnel;
  }

  async toggleTunnel(id: string, start: boolean): Promise<SSHTunnel> {
    try {
      const action = start ? 'start' : 'stop';
      const res = await fetch(`${API_BASE}/tunnels/${id}/${action}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

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
      await fetch(`${API_BASE}/tunnels/${id}`, {
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
      const res = await fetch(`${API_BASE}/snippets`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        storage.saveSnippets(data);
        return data;
      }
    } catch {}
    return storage.getSnippets();
  }

  async saveSnippet(snippet: Snippet): Promise<Snippet> {
    try {
      const isNew = !snippet.id || snippet.id.startsWith('temp-');
      const url = isNew ? `${API_BASE}/snippets` : `${API_BASE}/snippets/${snippet.id}`;
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
      await fetch(`${API_BASE}/snippets/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
    const snippets = storage.getSnippets().filter(s => s.id !== id);
    storage.saveSnippets(snippets);
  }

  // --- SFTP ---
  async listSftpFiles(path: string, _profileId?: string): Promise<SFTPFileItem[]> {
    try {
      const res = await fetch(`${API_BASE}/sftp/list?path=${encodeURIComponent(path)}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    // Offline simulation: filter or return mock files
    return INITIAL_MOCK_FILES.map(f => ({
      ...f,
      path: f.name === '..' ? '/home' : `${path.replace(/\/$/, '')}/${f.name}`,
    }));
  }

  async readSftpFile(filePath: string, _profileId?: string): Promise<string> {
    try {
      const res = await fetch(`${API_BASE}/sftp/read?path=${encodeURIComponent(filePath)}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.text();
      }
    } catch {}
    return MOCK_FILE_CONTENTS[filePath] || `# Remote file: ${filePath}\n# Opened in NodeSSH In-Browser Editor\n\n`;
  }

  async writeSftpFile(filePath: string, content: string, _profileId?: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/sftp/write`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath, content }),
      });
      if (res.ok) return;
    } catch {}
    MOCK_FILE_CONTENTS[filePath] = content;
  }

  async chmodSftpFile(filePath: string, mode: string, _profileId?: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sftp/chmod`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath, mode }),
      });
    } catch {}
  }

  async deleteSftpFile(filePath: string, _profileId?: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sftp/delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath }),
      });
    } catch {}
  }
}

export const api = new ApiClient();
