import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Send, Server, Check, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PushKeyModal: React.FC = () => {
  const {
    isPushKeyOpen,
    setIsPushKeyOpen,
    pushKeyTarget,
    setPushKeyTarget,
    profiles,
    pushKeyToServer,
  } = useApp();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [host, setHost] = useState('192.168.1.150');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('ubuntu');
  const [password, setPassword] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    if (profiles.length > 0) {
      const p = profiles[0];
      setSelectedProfileId(p.id);
      setHost(p.host);
      setPort(p.port);
      setUsername(p.username);
    }
  }, [profiles, isPushKeyOpen]);

  const handleProfileSelect = (pId: string) => {
    setSelectedProfileId(pId);
    const p = profiles.find(item => item.id === pId);
    if (p) {
      setHost(p.host);
      setPort(p.port);
      setUsername(p.username);
      if (p.password) setPassword(p.password);
    }
  };

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushKeyTarget) return;

    setIsPushing(true);
    try {
      await pushKeyToServer({
        host: host.trim(),
        port,
        username: username.trim(),
        password,
        publicKey: pushKeyTarget.publicKey,
      });
      setIsPushKeyOpen(false);
      setPushKeyTarget(null);
    } finally {
      setIsPushing(false);
    }
  };

  if (!pushKeyTarget) return null;

  return (
    <Modal
      isOpen={isPushKeyOpen}
      onClose={() => {
        setIsPushKeyOpen(false);
        setPushKeyTarget(null);
      }}
      title="Push Public Key to Server (ssh-copy-id)"
      subtitle={`Installing "${pushKeyTarget.name}" to remote ~/.ssh/authorized_keys`}
      icon={<Send className="w-5 h-5" />}
      maxWidth="lg"
    >
      <form onSubmit={handlePush} className="space-y-4 text-xs text-slate-200">
        {/* Target Key Info */}
        <div className="p-3 bg-[#0e1222] border border-cyan-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-semibold text-white">{pushKeyTarget.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">{pushKeyTarget.fingerprint}</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
            {pushKeyTarget.type}
          </span>
        </div>

        {/* Server Select */}
        {profiles.length > 0 && (
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Select Server Profile</label>
            <select
              value={selectedProfileId}
              onChange={e => handleProfileSelect(e.target.value)}
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            >
              <option value="">Custom Host</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.username}@{p.host}:{p.port})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Host & Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-slate-300 font-semibold mb-1">Target Host</label>
            <input
              type="text"
              required
              value={host}
              onChange={e => setHost(e.target.value)}
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">SSH Port</label>
            <input
              type="number"
              required
              value={port}
              onChange={e => setPort(parseInt(e.target.value, 10) || 22)}
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>
        </div>

        {/* Username & Password for auth */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Remote Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">One-Time Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Server user password..."
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          NodeSSH connects securely with password, verifies <code className="text-cyan-300 font-mono">~/.ssh/authorized_keys</code> directory permissions, and appends this public key.
        </p>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              setIsPushKeyOpen(false);
              setPushKeyTarget(null);
            }}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPushing}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-bold text-xs shadow-lg transition-all"
          >
            <Send className="w-4 h-4" />
            <span>{isPushing ? 'Pushing Public Key...' : 'Push Public Key'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
