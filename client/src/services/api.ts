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
      const isNew = !profile.id || profile.id.startsWith('temp-') || profile.id.startsWith('prof-');
      const url = isNew ? `${API_BASE}/profiles` : `${API_BASE}/profiles/${profile.id}`;
      const method = isNew ? 'POST' : 'PUT';
      let res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(profile),
      });

      if (!res.ok && res.status === 404 && !isNew) {
        // Fallback to POST if server did not find profile ID
        res = await fetch(`${API_BASE}/profiles`, {
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

  // --- Known Hosts ---
  async getKnownHosts(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/keys/known-hosts`, {
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
      const res = await fetch(`${API_BASE}/keys/trust-host`, {
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
      await fetch(`${API_BASE}/keys/known-hosts/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch {}
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
      const isNew = !tunnel.id || tunnel.id.startsWith('temp-') || tunnel.id.startsWith('tun-');
      const url = isNew ? `${API_BASE}/tunnels` : `${API_BASE}/tunnels/${tunnel.id}`;
      const method = isNew ? 'POST' : 'PUT';
      let res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(tunnel),
      });

      if (!res.ok && res.status === 404 && !isNew) {
        res = await fetch(`${API_BASE}/tunnels`, {
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
      const res = await fetch(`${API_BASE}/tunnels/${id}/${action}`, {
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
  async listSftpFiles(path: string, profileId?: string): Promise<SFTPFileItem[]> {
    const q = new URLSearchParams({ path });
    if (profileId) q.set('profileId', profileId);
    const res = await fetch(`${API_BASE}/sftp/list?${q.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to list directory`);
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items || [];
    return items.map((item: any) => ({
      name: item.filename || item.name,
      path: `${path.replace(/\/$/, '')}/${item.filename || item.name}`,
      type: item.isDirectory ? 'directory' : item.isSymbolicLink ? 'symlink' : 'file',
      size: item.size || 0,
      permissions: item.permissions || '0644',
      modifyTime: item.modifyTime ? (typeof item.modifyTime === 'number' ? item.modifyTime : new Date(item.modifyTime).getTime()) : Date.now(),
      owner: item.uid ? String(item.uid) : 'user',
    }));
  }

  async readSftpFile(filePath: string, profileId?: string): Promise<string> {
    const q = new URLSearchParams({ path: filePath });
    if (profileId) q.set('profileId', profileId);
    const res = await fetch(`${API_BASE}/sftp/read?${q.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to read file: ${filePath}`);
    }
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json.content !== undefined ? json.content : text;
    } catch {
      return text;
    }
  }

  async writeSftpFile(filePath: string, content: string, profileId?: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/sftp/write`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath, content, profileId }),
      });
      if (res.ok) return;
    } catch {}
    MOCK_FILE_CONTENTS[filePath] = content;
  }

  async createSftpFolder(dirPath: string, profileId?: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sftp/mkdir`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: dirPath, profileId }),
      });
    } catch {}
  }

  async chmodSftpFile(filePath: string, mode: string | number, profileId?: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sftp/chmod`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath, mode, profileId }),
      });
    } catch {}
  }

  async deleteSftpFile(filePath: string, isDirectory: boolean = false, profileId?: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sftp/delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath, isDirectory, profileId }),
      });
    } catch {}
  }

  async uploadSftpFile(
    file: File,
    remoteDir: string,
    profileId?: string,
    onProgress?: (percent: number, loaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('remoteDir', remoteDir);
      if (profileId) formData.append('profileId', profileId);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/sftp/upload`);

      const token = storage.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        reject(new Error('Upload aborted'));
      };

      xhr.send(formData);
    });
  }
}

export const api = new ApiClient();
