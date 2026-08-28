import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  ServerProfile,
  KeyVaultItem,
  SSHTunnel,
  Snippet,
  AppSettings,
  SFTPFileItem,
} from '../types';
import { storage } from '../services/storage';
import { api } from '../services/api';

export type NavView = 'terminals' | 'profiles' | 'tunnels' | 'keys' | 'snippets' | 'settings';

interface AppContextType {
  // Navigation
  activeView: NavView;
  setActiveView: (view: NavView) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  // Profiles
  profiles: ServerProfile[];
  selectedProfile: ServerProfile | null;
  setSelectedProfile: (p: ServerProfile | null) => void;
  saveProfile: (p: ServerProfile) => Promise<ServerProfile>;
  deleteProfile: (id: string) => Promise<void>;
  importProfiles: (profiles: Partial<ServerProfile>[]) => Promise<void>;

  // Keys
  keys: KeyVaultItem[];
  saveKey: (k: KeyVaultItem) => Promise<KeyVaultItem>;
  deleteKey: (id: string) => Promise<void>;
  pushKeyToServer: (params: { host: string; port: number; username: string; password?: string; publicKey: string }) => Promise<{ success: boolean; message: string }>;

  // Tunnels
  tunnels: SSHTunnel[];
  saveTunnel: (t: SSHTunnel) => Promise<SSHTunnel>;
  toggleTunnel: (id: string, start: boolean) => Promise<void>;
  deleteTunnel: (id: string) => Promise<void>;
  lanIp: string;

  // Snippets
  snippets: Snippet[];
  saveSnippet: (s: Snippet) => Promise<Snippet>;
  deleteSnippet: (id: string) => Promise<void>;

  // Settings
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // SFTP & Modals state
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  editingProfile: ServerProfile | null;
  setEditingProfile: (p: ServerProfile | null) => void;

  isImportExportOpen: boolean;
  setIsImportExportOpen: (open: boolean) => void;

  isKeyGenOpen: boolean;
  setIsKeyGenOpen: (open: boolean) => void;

  isKeyImportOpen: boolean;
  setIsKeyImportOpen: (open: boolean) => void;

  isPushKeyOpen: boolean;
  setIsPushKeyOpen: (open: boolean) => void;
  pushKeyTarget: KeyVaultItem | null;
  setPushKeyTarget: (k: KeyVaultItem | null) => void;

  isAddTunnelOpen: boolean;
  setIsAddTunnelOpen: (open: boolean) => void;
  editingTunnel: SSHTunnel | null;
  setEditingTunnel: (t: SSHTunnel | null) => void;

  isSnippetModalOpen: boolean;
  setIsSnippetModalOpen: (open: boolean) => void;
  editingSnippet: Snippet | null;
  setEditingSnippet: (s: Snippet | null) => void;

  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;

  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;

  // Host Key Verification (TOFU & MITM Protection)
  hostKeyPrompt: {
    host: string;
    port: number;
    keyType: string;
    fingerprint: string;
    status: 'new' | 'mismatch';
    storedFingerprint?: string;
  } | null;
  setHostKeyPrompt: (data: any) => void;
  resolveHostKeyPrompt: (accept: boolean, saveToKnownHosts: boolean) => void;

  // SFTP Modals
  editingFile: SFTPFileItem | null;
  setEditingFile: (file: SFTPFileItem | null) => void;
  editingPermissionsFile: SFTPFileItem | null;
  setEditingPermissionsFile: (file: SFTPFileItem | null) => void;

  // Global Notification / Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<NavView>('terminals');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const [profiles, setProfiles] = useState<ServerProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ServerProfile | null>(null);

  const [keys, setKeys] = useState<KeyVaultItem[]>([]);
  const [tunnels, setTunnels] = useState<SSHTunnel[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());
  const [lanIp, setLanIp] = useState<string>('192.168.1.100');

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ServerProfile | null>(null);

  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
  const [isKeyImportOpen, setIsKeyImportOpen] = useState(false);
  const [isPushKeyOpen, setIsPushKeyOpen] = useState(false);
  const [pushKeyTarget, setPushKeyTarget] = useState<KeyVaultItem | null>(null);

  const [isAddTunnelOpen, setIsAddTunnelOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<SSHTunnel | null>(null);

  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  // Host Key Prompt state
  const [hostKeyPrompt, setHostKeyPrompt] = useState<{
    host: string;
    port: number;
    keyType: string;
    fingerprint: string;
    status: 'new' | 'mismatch';
    storedFingerprint?: string;
    onDecision?: (accept: boolean, saveToKnownHosts: boolean) => void;
  } | null>(null);

  const resolveHostKeyPrompt = useCallback((accept: boolean, saveToKnownHosts: boolean) => {
    if (hostKeyPrompt?.onDecision) {
      hostKeyPrompt.onDecision(accept, saveToKnownHosts);
    }
    if (accept && saveToKnownHosts && hostKeyPrompt) {
      api.trustHost({
        host: hostKeyPrompt.host,
        port: hostKeyPrompt.port,
        keyType: hostKeyPrompt.keyType,
        fingerprint: hostKeyPrompt.fingerprint,
      });
      showToast(`Saved host key for ${hostKeyPrompt.host}:${hostKeyPrompt.port} to Known Hosts`, 'success');
    }
    setHostKeyPrompt(null);
  }, [hostKeyPrompt, showToast]);

  const [editingFile, setEditingFile] = useState<SFTPFileItem | null>(null);
  const [editingPermissionsFile, setEditingPermissionsFile] = useState<SFTPFileItem | null>(null);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      const [loadedProfiles, loadedKeys, loadedTunnels, loadedSnippets, detectedIp] = await Promise.all([
        api.getProfiles(),
        api.getKeys(),
        api.getTunnels(),
        api.getSnippets(),
        api.getLanIp(),
      ]);
      setProfiles(loadedProfiles);
      setKeys(loadedKeys);
      setTunnels(loadedTunnels);
      setSnippets(loadedSnippets);
      setLanIp(detectedIp);
    };

    loadAll();
  }, []);

  // Live timer for active tunnels
  useEffect(() => {
    const interval = setInterval(() => {
      setTunnels(prevTunnels =>
        prevTunnels.map(t => {
          if (t.status === 'active') {
            return {
              ...t,
              uptimeSeconds: t.uptimeSeconds + 1,
              bytesIn: t.bytesIn + Math.floor(Math.random() * 250),
              bytesOut: t.bytesOut + Math.floor(Math.random() * 600),
            };
          }
          return t;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Profiles operations
  const saveProfile = async (p: ServerProfile): Promise<ServerProfile> => {
    const saved = await api.saveProfile(p);
    setProfiles(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    showToast(`Profile "${saved.name}" saved successfully`, 'success');
    return saved;
  };

  const deleteProfile = async (id: string) => {
    await api.deleteProfile(id);
    setProfiles(prev => prev.filter(p => p.id !== id));
    showToast('Profile deleted', 'info');
  };

  const importProfiles = async (importedList: Partial<ServerProfile>[]) => {
    const newProfiles: ServerProfile[] = importedList.map((p, idx) => ({
      id: 'prof-imp-' + Date.now() + '-' + idx,
      name: p.name || `Imported Server ${idx + 1}`,
      host: p.host || '127.0.0.1',
      port: p.port || 22,
      username: p.username || 'root',
      authType: p.authType || 'password',
      folder: p.folder || 'Imported',
      tags: p.tags || ['Imported'],
      colorTag: p.colorTag || '#3b82f6',
      closeSessionOnExit: true,
      keepaliveInterval: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    for (const np of newProfiles) {
      await api.saveProfile(np);
    }
    setProfiles(prev => [...newProfiles, ...prev]);
    showToast(`Successfully imported ${newProfiles.length} profiles!`, 'success');
  };

  // Keys operations
  const saveKey = async (k: KeyVaultItem): Promise<KeyVaultItem> => {
    const saved = await api.saveKey(k);
    setKeys(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    showToast(`Key "${saved.name}" saved to vault`, 'success');
    return saved;
  };

  const deleteKey = async (id: string) => {
    await api.deleteKey(id);
    setKeys(prev => prev.filter(k => k.id !== id));
    showToast('Key removed from vault', 'info');
  };

  const pushKeyToServer = async (params: {
    host: string;
    port: number;
    username: string;
    password?: string;
    publicKey: string;
  }) => {
    const res = await api.pushKeyToServer(params);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
    return res;
  };

  // Tunnels operations
  const saveTunnel = async (t: SSHTunnel): Promise<SSHTunnel> => {
    const saved = await api.saveTunnel(t);
    setTunnels(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    showToast(`Tunnel "${saved.name}" saved`, 'success');
    return saved;
  };

  const toggleTunnel = async (id: string, start: boolean) => {
    try {
      const updated = await api.toggleTunnel(id, start);
      setTunnels(prev => prev.map(t => (t.id === id ? updated : t)));
      showToast(`Tunnel ${start ? 'started' : 'stopped'}`, start ? 'success' : 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle tunnel', 'error');
    }
  };

  const deleteTunnel = async (id: string) => {
    await api.deleteTunnel(id);
    setTunnels(prev => prev.filter(t => t.id !== id));
    showToast('Tunnel removed', 'info');
  };

  // Snippets operations
  const saveSnippet = async (s: Snippet): Promise<Snippet> => {
    const saved = await api.saveSnippet(s);
    setSnippets(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    showToast(`Snippet "${saved.name}" saved`, 'success');
    return saved;
  };

  const deleteSnippet = async (id: string) => {
    await api.deleteSnippet(id);
    setSnippets(prev => prev.filter(s => s.id !== id));
    showToast('Snippet deleted', 'info');
  };

  // Settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    storage.saveSettings(updated);
    showToast('Settings saved', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        isSidebarCollapsed,
        setIsSidebarCollapsed,

        profiles,
        selectedProfile,
        setSelectedProfile,
        saveProfile,
        deleteProfile,
        importProfiles,

        keys,
        saveKey,
        deleteKey,
        pushKeyToServer,

        tunnels,
        saveTunnel,
        toggleTunnel,
        deleteTunnel,
        lanIp,

        snippets,
        saveSnippet,
        deleteSnippet,

        settings,
        updateSettings,

        isProfileModalOpen,
        setIsProfileModalOpen,
        editingProfile,
        setEditingProfile,

        isImportExportOpen,
        setIsImportExportOpen,

        isKeyGenOpen,
        setIsKeyGenOpen,

        isKeyImportOpen,
        setIsKeyImportOpen,

        isPushKeyOpen,
        setIsPushKeyOpen,
        pushKeyTarget,
        setPushKeyTarget,

        isAddTunnelOpen,
        setIsAddTunnelOpen,
        editingTunnel,
        setEditingTunnel,

        isSnippetModalOpen,
        setIsSnippetModalOpen,
        editingSnippet,
        setEditingSnippet,

        isSettingsOpen,
        setIsSettingsOpen,

        isShortcutsOpen,
        setIsShortcutsOpen,

        hostKeyPrompt,
        setHostKeyPrompt,
        resolveHostKeyPrompt,

        editingFile,
        setEditingFile,
        editingPermissionsFile,
        setEditingPermissionsFile,

        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
