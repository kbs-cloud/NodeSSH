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

export const DEFAULT_PROFILES: ServerProfile[] = [];
export const DEFAULT_KEYS: KeyVaultItem[] = [];
export const DEFAULT_TUNNELS: SSHTunnel[] = [];
export const DEFAULT_SNIPPETS: Snippet[] = [];

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
