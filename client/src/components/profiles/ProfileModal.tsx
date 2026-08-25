import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Server, Check, Folder, Tag, ShieldCheck, Terminal as TerminalIcon } from 'lucide-react';
import { ServerProfile } from '../../types';
import { useApp } from '../../context/AppContext';

export const ProfileModal: React.FC = () => {
  const {
    isProfileModalOpen,
    setIsProfileModalOpen,
    editingProfile,
    setEditingProfile,
    saveProfile,
    profiles,
    keys,
  } = useApp();

  const [name, setName] = useState('');
  const [folder, setFolder] = useState('Default');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('ubuntu');
  const [authType, setAuthType] = useState<'password' | 'key' | 'agent' | 'none'>('password');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState('');
  const [jumpHostId, setJumpHostId] = useState('');
  const [defaultPath, setDefaultPath] = useState('/home/ubuntu');
  const [startupCommand, setStartupCommand] = useState('');
  const [closeSessionOnExit, setCloseSessionOnExit] = useState(true);
  const [keepaliveInterval, setKeepaliveInterval] = useState(30);
  const [tagsString, setTagsString] = useState('Linux, SSH');
  const [colorTag, setColorTag] = useState('#00f0ff');

  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name);
      setFolder(editingProfile.folder || 'Default');
      setHost(editingProfile.host);
      setPort(editingProfile.port);
      setUsername(editingProfile.username);
      setAuthType(editingProfile.authType);
      setPassword(editingProfile.password || '');
      setKeyId(editingProfile.keyId || '');
      setJumpHostId(editingProfile.jumpHostId || '');
      setDefaultPath(editingProfile.defaultPath || '/home/ubuntu');
      setStartupCommand(editingProfile.startupCommand || '');
      setCloseSessionOnExit(editingProfile.closeSessionOnExit ?? true);
      setKeepaliveInterval(editingProfile.keepaliveInterval || 30);
      setTagsString(editingProfile.tags.join(', '));
      setColorTag(editingProfile.colorTag || '#00f0ff');
    } else {
      setName('Ubuntu Server');
      setFolder('Production');
      setHost('192.168.1.150');
      setPort(22);
      setUsername('ubuntu');
      setAuthType('password');
      setPassword('');
      setKeyId(keys.length > 0 ? keys[0].id : '');
      setJumpHostId('');
      setDefaultPath('/home/ubuntu');
      setStartupCommand('');
      setCloseSessionOnExit(true);
      setKeepaliveInterval(30);
      setTagsString('Production, Ubuntu');
      setColorTag('#00f0ff');
    }
  }, [editingProfile, keys, isProfileModalOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsString.split(',').map(t => t.trim()).filter(Boolean);

    const profileData: ServerProfile = {
      id: editingProfile ? editingProfile.id : 'prof-' + Date.now(),
      name: name.trim() || `${username}@${host}`,
      folder: folder.trim() || 'Default',
      host: host.trim(),
      port,
      username: username.trim(),
      authType,
      password: authType === 'password' ? password : undefined,
      keyId: authType === 'key' ? keyId : undefined,
      jumpHostId: jumpHostId || undefined,
      defaultPath: defaultPath.trim() || undefined,
      startupCommand: startupCommand.trim() || undefined,
      closeSessionOnExit,
      keepaliveInterval,
      tags,
      colorTag,
      createdAt: editingProfile ? editingProfile.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveProfile(profileData);
    setIsProfileModalOpen(false);
    setEditingProfile(null);
  };

  const colorOptions = ['#00f0ff', '#9d4edf', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <Modal
      isOpen={isProfileModalOpen}
      onClose={() => {
        setIsProfileModalOpen(false);
        setEditingProfile(null);
      }}
      title={editingProfile ? 'Edit Server Profile' : 'New Server Profile'}
      subtitle="Configure host, authentication, JumpHost, and session parameters"
      icon={<Server className="w-5 h-5" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Profile Name & Folder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Profile Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production Web Ubuntu"
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Folder Group</label>
            <input
              type="text"
              value={folder}
              onChange={e => setFolder(e.target.value)}
              placeholder="e.g. Production, AWS, HomeLab"
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>

        {/* Host & Port */}
        <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-3">
          <div className="font-semibold text-slate-300">SSH Connection Parameters</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 text-[11px] mb-1">Host / IP Address</label>
              <input
                type="text"
                required
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="192.168.1.150 or server.domain.com"
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={e => setPort(parseInt(e.target.value, 10) || 22)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Authentication Type</label>
              <select
                value={authType}
                onChange={e => setAuthType(e.target.value as any)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              >
                <option value="password">Password</option>
                <option value="key">Private Key (Vault)</option>
                <option value="agent">SSH Agent / Pageant</option>
                <option value="none">Interactive Prompt</option>
              </select>
            </div>
          </div>

          {/* Conditional Auth Input */}
          {authType === 'password' && (
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
          )}

          {authType === 'key' && (
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Select Key from Vault</label>
              <select
                value={keyId}
                onChange={e => setKeyId(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              >
                <option value="">-- Choose Key --</option>
                {keys.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.type} - {k.fingerprint.slice(0, 16)}...)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Jump Host & Advanced */}
        <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-3">
          <div className="font-semibold text-slate-300">Advanced & Bastion Chaining</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">JumpHost / Bastion (ProxyJump)</label>
              <select
                value={jumpHostId}
                onChange={e => setJumpHostId(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
              >
                <option value="">Direct Connection (No JumpHost)</option>
                {profiles
                  .filter(p => p.id !== editingProfile?.id)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.host})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Default Remote Path</label>
              <input
                type="text"
                value={defaultPath}
                onChange={e => setDefaultPath(e.target.value)}
                placeholder="/home/ubuntu or /var/www"
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] mb-1">Startup Command (Executed on connect)</label>
            <input
              type="text"
              value={startupCommand}
              onChange={e => setStartupCommand(e.target.value)}
              placeholder="e.g. tmux attach || tmux new, htop, etc."
              className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={closeSessionOnExit}
                onChange={e => setCloseSessionOnExit(e.target.checked)}
                className="accent-cyan-400 w-4 h-4"
              />
              <span className="text-slate-300">Kill SSH session when tab is closed</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Keepalive:</span>
              <input
                type="number"
                value={keepaliveInterval}
                onChange={e => setKeepaliveInterval(parseInt(e.target.value, 10) || 30)}
                className="w-16 bg-[#070913] border border-white/10 rounded px-2 py-1 text-white font-mono text-xs"
              />
              <span className="text-slate-500 text-[10px]">sec</span>
            </div>
          </div>
        </div>

        {/* Tags and Color Tag */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsString}
              onChange={e => setTagsString(e.target.value)}
              placeholder="Web, Docker, Nginx, Production"
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Color Tag</label>
            <div className="flex items-center gap-2 pt-1">
              {colorOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorTag(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    colorTag === c ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              setIsProfileModalOpen(false);
              setEditingProfile(null);
            }}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-semibold text-xs shadow-lg transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{editingProfile ? 'Save Profile' : 'Create Profile'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
