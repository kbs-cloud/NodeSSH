import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { FolderTree, Server, Key, Lock, Globe, ArrowRight } from 'lucide-react';
import { ServerProfile } from '../../types';
import { useApp } from '../../context/AppContext';

interface DirectConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (profile: Partial<ServerProfile>) => void;
}

export const DirectConnectModal: React.FC<DirectConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
}) => {
  const { profiles, keys } = useApp();

  const [mode, setMode] = useState<'profile' | 'manual'>('profile');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles.length > 0 ? profiles[0].id : ''
  );

  // Manual connection fields
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [defaultPath, setDefaultPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'profile') {
      const p = profiles.find((prof) => prof.id === selectedProfileId);
      if (p) {
        onConnect(p);
        onClose();
      }
    } else {
      if (!host.trim() || !username.trim()) return;
      const directTarget: Partial<ServerProfile> = {
        name: name.trim() || `${username}@${host}`,
        host: host.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        authType,
        password: authType === 'password' ? password : undefined,
        keyId: authType === 'key' ? keyId : undefined,
        passphrase: authType === 'key' ? passphrase : undefined,
        defaultPath: defaultPath.trim() || undefined,
      };
      onConnect(directTarget);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Standalone SFTP Session"
      subtitle="Browse and transfer files via SFTP without spawning an interactive terminal"
      icon={<FolderTree className="w-5 h-5 text-cyan-400" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => setMode('profile')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              mode === 'profile'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Saved Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              mode === 'manual'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Quick Connect</span>
          </button>
        </div>

        {mode === 'profile' ? (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Server Profile
            </label>
            {profiles.length > 0 ? (
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.username}@{p.host}:{p.port})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-4 rounded-lg bg-white/5 text-center text-xs text-slate-400">
                No saved profiles found. Switch to Quick Connect tab to connect directly.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Host / IP</label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.100 or server.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="root, ubuntu, etc."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Auth Type</label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as 'password' | 'key')}
                  className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="password">Password</option>
                  <option value="key">Key Vault / SSH Key</option>
                </select>
              </div>
            </div>

            {authType === 'password' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Remote password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select Key</label>
                  <select
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select a key from vault...</option>
                    {keys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Passphrase (optional)</label>
                  <input
                    type="password"
                    placeholder="Key passphrase if encrypted"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Initial Remote Path (optional)</label>
              <input
                type="text"
                placeholder="/var/www, /home/user, etc."
                value={defaultPath}
                onChange={(e) => setDefaultPath(e.target.value)}
                className="w-full bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--theme-border,#1e2640)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Open SFTP Session</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  );
};
