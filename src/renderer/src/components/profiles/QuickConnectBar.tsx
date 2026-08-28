import React, { useState } from 'react';
import { Zap, Server, Key, Lock, ArrowRight } from 'lucide-react';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';

export const QuickConnectBar: React.FC = () => {
  const { addTab } = useTerminal();
  const { keys, saveProfile, showToast } = useApp();

  const [connectionString, setConnectionString] = useState('');
  const [password, setPassword] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [saveAsProfile, setSaveAsProfile] = useState(false);
  const [showAuthFields, setShowAuthFields] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = connectionString.trim();
    if (!raw) return;

    // Parse username@host:port or host:port or host
    let username = 'root';
    let host = raw;
    let port = 22;

    if (raw.includes('@')) {
      const parts = raw.split('@');
      username = parts[0];
      host = parts[1];
    }

    if (host.includes(':')) {
      const parts = host.split(':');
      host = parts[0];
      port = parseInt(parts[1], 10) || 22;
    }

    const profileData = {
      name: `${username}@${host}`,
      host,
      port,
      username,
      authType: (selectedKeyId ? 'key' : password ? 'password' : 'none') as any,
      password: password || undefined,
      keyId: selectedKeyId || undefined,
      folder: 'Quick Connect',
      tags: ['Ad-Hoc'],
      closeSessionOnExit: true,
    };

    if (saveAsProfile) {
      await saveProfile({
        id: 'prof-' + Date.now(),
        ...profileData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    addTab({
      profile: profileData,
      title: `${username}@${host}`,
    });

    setConnectionString('');
    setPassword('');
    setShowAuthFields(false);
    showToast(`Initiating connection to ${username}@${host}:${port}...`, 'info');
  };

  return (
    <form onSubmit={handleConnect} className="flex items-center gap-2 text-xs">
      {/* Host input */}
      <div className="relative flex items-center min-w-[240px] sm:min-w-[280px]">
        <Server className="w-3.5 h-3.5 absolute left-2.5 text-cyan-400 opacity-80" />
        <input
          type="text"
          placeholder="user@host:port (e.g. ubuntu@192.168.1.150)"
          value={connectionString}
          onChange={e => {
            setConnectionString(e.target.value);
            if (e.target.value && !showAuthFields) setShowAuthFields(true);
          }}
          className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/40 focus:border-cyan-400 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 text-xs font-mono outline-none transition-all"
        />
      </div>

      {/* Expandable Auth Fields */}
      {showAuthFields && (
        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
          {/* Password field */}
          <div className="relative flex items-center w-28">
            <Lock className="w-3 h-3 absolute left-2 text-slate-400" />
            <input
              type="password"
              placeholder="Password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg pl-6 pr-2 py-1.5 text-slate-100 placeholder-slate-500 text-xs outline-none focus:border-cyan-400"
            />
          </div>

          {/* Key Vault Selector */}
          {keys.length > 0 && (
            <select
              value={selectedKeyId}
              onChange={e => setSelectedKeyId(e.target.value)}
              className="bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-2 py-1.5 text-slate-200 text-xs outline-none focus:border-cyan-400"
            >
              <option value="">No Key</option>
              {keys.map(k => (
                <option key={k.id} value={k.id}>
                  Key: {k.name}
                </option>
              ))}
            </select>
          )}

          {/* Save checkbox */}
          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveAsProfile}
              onChange={e => setSaveAsProfile(e.target.checked)}
              className="accent-cyan-400 rounded w-3.5 h-3.5"
            />
            <span className="hidden md:inline">Save</span>
          </label>
        </div>
      )}

      {/* Connect button */}
      <button
        type="submit"
        disabled={!connectionString.trim()}
        className="flex items-center gap-1 px-3 py-1.5 bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-40 text-black font-bold rounded-lg text-xs transition-all shadow-md active:scale-95"
      >
        <Zap className="w-3.5 h-3.5 fill-current" />
        <span>Connect</span>
      </button>
    </form>
  );
};
