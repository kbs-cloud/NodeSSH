import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Network, Plus, Check } from 'lucide-react';
import { SSHTunnel, TunnelType } from '../../types';
import { useApp } from '../../context/AppContext';

export const AddTunnelModal: React.FC = () => {
  const {
    isAddTunnelOpen,
    setIsAddTunnelOpen,
    editingTunnel,
    setEditingTunnel,
    saveTunnel,
    profiles,
    keys,
    lanIp,
  } = useApp();

  const [name, setName] = useState('');
  const [type, setType] = useState<TunnelType>('local');
  const [bindHost, setBindHost] = useState<'0.0.0.0' | '127.0.0.1'>('0.0.0.0');
  const [bindPort, setBindPort] = useState<number>(5433);
  const [remoteHost, setRemoteHost] = useState<string>('127.0.0.1');
  const [remotePort, setRemotePort] = useState<number>(5432);
  const [sshProfileId, setSshProfileId] = useState<string>('');
  const [sshHost, setSshHost] = useState<string>('192.168.1.150');
  const [sshPort, setSshPort] = useState<number>(22);
  const [sshUser, setSshUser] = useState<string>('ubuntu');
  const [sshKeyId, setSshKeyId] = useState<string>('');
  const [jumpHostId, setJumpHostId] = useState<string>('');
  const [autoStart, setAutoStart] = useState<boolean>(true);

  useEffect(() => {
    if (editingTunnel) {
      setName(editingTunnel.name);
      setType(editingTunnel.type);
      setBindHost(editingTunnel.bindHost === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1');
      setBindPort(editingTunnel.bindPort);
      setRemoteHost(editingTunnel.remoteHost);
      setRemotePort(editingTunnel.remotePort);
      setSshProfileId(editingTunnel.sshProfileId || '');
      setSshHost(editingTunnel.sshHost);
      setSshPort(editingTunnel.sshPort);
      setSshUser(editingTunnel.sshUser);
      setSshKeyId(editingTunnel.sshKeyId || '');
      setJumpHostId(editingTunnel.jumpHostId || '');
      setAutoStart(editingTunnel.autoStart ?? true);
    } else {
      setName('New SSH Tunnel');
      setType('local');
      setBindHost('0.0.0.0');
      setBindPort(5433);
      setRemoteHost('127.0.0.1');
      setRemotePort(5432);
      setSshProfileId(profiles.length > 0 ? profiles[0].id : '');
      setSshHost(profiles.length > 0 ? profiles[0].host : '192.168.1.150');
      setSshPort(profiles.length > 0 ? profiles[0].port : 22);
      setSshUser(profiles.length > 0 ? profiles[0].username : 'ubuntu');
      setSshKeyId('');
      setJumpHostId('');
      setAutoStart(true);
    }
  }, [editingTunnel, profiles, isAddTunnelOpen]);

  const handleProfileSelect = (pId: string) => {
    setSshProfileId(pId);
    const p = profiles.find(item => item.id === pId);
    if (p) {
      setSshHost(p.host);
      setSshPort(p.port);
      setSshUser(p.username);
      setSshKeyId(p.keyId || '');
      setJumpHostId(p.jumpHostId || '');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tunnelData: SSHTunnel = {
      id: editingTunnel ? editingTunnel.id : 'tun-' + Date.now(),
      name: name.trim() || 'SSH Tunnel',
      type,
      status: editingTunnel ? editingTunnel.status : 'stopped',
      bindHost,
      bindPort,
      remoteHost: type === 'socks5' ? 'dynamic' : remoteHost.trim(),
      remotePort: type === 'socks5' ? 0 : remotePort,
      sshProfileId: sshProfileId || undefined,
      sshHost: sshHost.trim(),
      sshPort,
      sshUser: sshUser.trim(),
      sshKeyId: sshKeyId || undefined,
      jumpHostId: jumpHostId || undefined,
      autoStart,
      activeClients: editingTunnel ? editingTunnel.activeClients : 0,
      bytesIn: editingTunnel ? editingTunnel.bytesIn : 0,
      bytesOut: editingTunnel ? editingTunnel.bytesOut : 0,
      uptimeSeconds: editingTunnel ? editingTunnel.uptimeSeconds : 0,
    };

    await saveTunnel(tunnelData);
    setIsAddTunnelOpen(false);
    setEditingTunnel(null);
  };

  return (
    <Modal
      isOpen={isAddTunnelOpen}
      onClose={() => {
        setIsAddTunnelOpen(false);
        setEditingTunnel(null);
      }}
      title={editingTunnel ? 'Edit SSH Tunnel' : 'Create Visual SSH Tunnel'}
      subtitle="Configure port forwarding (-L, -R, -D) with optional LAN sharing"
      icon={<Network className="w-5 h-5" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Tunnel Name */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Tunnel Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Postgres DB Local Forward, Webhook Ingress"
            className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
          />
        </div>

        {/* Tunnel Type Selection */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1.5">Forwarding Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'local', title: 'Local Forward (-L)', desc: 'Forward local port to remote destination' },
              { id: 'remote', title: 'Remote Forward (-R)', desc: 'Forward remote server port back to local' },
              { id: 'socks5', title: 'SOCKS5 Proxy (-D)', desc: 'Dynamic proxy server for browser & LAN' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id as TunnelType)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  type === item.id
                    ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-md'
                    : 'bg-[#070913] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs text-cyan-300">{item.title}</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Listen / Bind Options */}
        <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-3">
          <div className="font-semibold text-slate-300">Local Binding & Port</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Bind Host (LAN Sharing)</label>
              <select
                value={bindHost}
                onChange={e => setBindHost(e.target.value as any)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              >
                <option value="0.0.0.0">0.0.0.0 (Allow WiFi / LAN Network Access)</option>
                <option value="127.0.0.1">127.0.0.1 (Localhost Workstation Only)</option>
              </select>
              {bindHost === '0.0.0.0' && (
                <p className="text-[10px] text-cyan-400 mt-1">
                  Accessible on LAN at: <code className="font-bold">{lanIp}:{bindPort}</code>
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Local Listen Port</label>
              <input
                type="number"
                required
                value={bindPort}
                onChange={e => setBindPort(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Remote Destination (for -L and -R) */}
        {type !== 'socks5' && (
          <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-3">
            <div className="font-semibold text-slate-300">Destination Service Target</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Destination Host</label>
                <input
                  type="text"
                  required
                  value={remoteHost}
                  onChange={e => setRemoteHost(e.target.value)}
                  placeholder="e.g. 127.0.0.1 or 10.0.4.20"
                  className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Destination Port</label>
                <input
                  type="number"
                  required
                  value={remotePort}
                  onChange={e => setRemotePort(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* SSH Server Configuration */}
        <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">SSH Routing Server</span>
            {profiles.length > 0 && (
              <select
                value={sshProfileId}
                onChange={e => handleProfileSelect(e.target.value)}
                className="bg-[#070913] border border-cyan-500/40 rounded px-2 py-1 text-cyan-300 text-[11px] outline-none"
              >
                <option value="">-- Load from Server Profile --</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.username}@{p.host})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 text-[11px] mb-1">SSH Host</label>
              <input
                type="text"
                required
                value={sshHost}
                onChange={e => setSshHost(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">SSH Port</label>
              <input
                type="number"
                required
                value={sshPort}
                onChange={e => setSshPort(parseInt(e.target.value, 10) || 22)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">SSH Username</label>
              <input
                type="text"
                required
                value={sshUser}
                onChange={e => setSshUser(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">SSH Key from Vault</label>
              <select
                value={sshKeyId}
                onChange={e => setSshKeyId(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
              >
                <option value="">Password / Agent</option>
                {keys.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              setIsAddTunnelOpen(false);
              setEditingTunnel(null);
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
            <span>{editingTunnel ? 'Save Tunnel' : 'Create Tunnel'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
