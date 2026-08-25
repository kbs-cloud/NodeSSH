import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Network, Plus, Zap, Shield, Globe, ArrowRight } from 'lucide-react';
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
    lanIp,
  } = useApp();

  const [name, setName] = useState('');
  const [type, setType] = useState<TunnelType>('direct');
  const [bindHost, setBindHost] = useState<'0.0.0.0' | '127.0.0.1'>('127.0.0.1');
  const [bindPort, setBindPort] = useState<number>(9022);
  const [remoteHost, setRemoteHost] = useState<string>('aragond.net');
  const [remotePort, setRemotePort] = useState<number>(22);
  const [sshProfileId, setSshProfileId] = useState<string>('');
  const [autoStart, setAutoStart] = useState<boolean>(false);

  useEffect(() => {
    if (editingTunnel) {
      setName(editingTunnel.name);
      setType(editingTunnel.type);
      setBindHost(editingTunnel.bindHost === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1');
      setBindPort(editingTunnel.bindPort);
      setRemoteHost(editingTunnel.remoteHost);
      setRemotePort(editingTunnel.remotePort);
      setSshProfileId(editingTunnel.sshProfileId || '');
      setAutoStart(editingTunnel.autoStart ?? false);
    } else {
      setName('');
      setType('direct');
      setBindHost('127.0.0.1');
      setBindPort(9022);
      setRemoteHost('aragond.net');
      setRemotePort(22);
      setSshProfileId(profiles.length > 0 ? profiles[0].id : '');
      setAutoStart(false);
    }
  }, [editingTunnel, profiles, isAddTunnelOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDirect = type === 'direct';
    const finalName = name.trim() || (isDirect ? `TCP Relay :${bindPort} -> ${remoteHost}:${remotePort}` : `SSH Tunnel :${bindPort}`);

    const tunnelData: SSHTunnel = {
      id: editingTunnel ? editingTunnel.id : 'tun-' + Date.now(),
      name: finalName,
      type,
      status: editingTunnel ? editingTunnel.status : 'stopped',
      bindHost,
      bindPort,
      remoteHost: type === 'socks5' ? 'dynamic' : remoteHost.trim(),
      remotePort: type === 'socks5' ? 0 : remotePort,
      sshProfileId: isDirect ? undefined : (sshProfileId || undefined),
      sshHost: '',
      sshPort: 22,
      sshUser: '',
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
      title={editingTunnel ? 'Edit Port Forward / Proxy' : 'New Port Forward / Proxy'}
      subtitle="Forward ports directly via local Node proxy or encapsulated through SSH"
      icon={<Network className="w-5 h-5 text-cyan-400" />}
      maxWidth="xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Forwarding Mode Selection */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1.5">Forwarding Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                id: 'direct',
                title: '⚡ Direct Node TCP Proxy',
                desc: 'Relay local port directly to target server via Node (no SSH hop)',
                color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
              },
              {
                id: 'local',
                title: '🔒 SSH Local Forward (-L)',
                desc: 'Forward local port through a remote SSH gateway server',
                color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
              },
              {
                id: 'remote',
                title: '🔄 SSH Remote Forward (-R)',
                desc: 'Forward remote server port back to this local machine',
                color: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
              },
              {
                id: 'socks5',
                title: '🌐 SOCKS5 Dynamic Proxy (-D)',
                desc: 'Dynamic SOCKS5 proxy server through SSH',
                color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
              },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id as TunnelType)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  type === item.id
                    ? `${item.color} shadow-md`
                    : 'bg-[#070913] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs">{item.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tunnel Name */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Tunnel / Proxy Name (Optional)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`e.g. ${type === 'direct' ? 'Aragond SSH Direct Relay' : 'Postgres Tunnel'}`}
            className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
          />
        </div>

        {/* Local Binding & Port */}
        <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-2.5">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span>1. Local Machine Port (Where you connect)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Local Listen Port</label>
              <input
                type="number"
                required
                value={bindPort}
                onChange={e => setBindPort(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono font-bold text-cyan-300"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Network Binding</label>
              <select
                value={bindHost}
                onChange={e => setBindHost(e.target.value as any)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              >
                <option value="127.0.0.1">127.0.0.1 (This PC only)</option>
                <option value="0.0.0.0">0.0.0.0 (Allow LAN / other devices)</option>
              </select>
              {bindHost === '0.0.0.0' && (
                <p className="text-[10px] text-cyan-400 mt-1">
                  LAN Address: <code className="font-bold">{lanIp}:{bindPort}</code>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Remote Destination */}
        {type !== 'socks5' && (
          <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-2.5">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>2. Destination Target (Where traffic is sent)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-slate-400 text-[11px] mb-1">Destination Host / Domain</label>
                <input
                  type="text"
                  required
                  value={remoteHost}
                  onChange={e => setRemoteHost(e.target.value)}
                  placeholder="e.g. aragond.net, 192.168.1.215, localhost"
                  className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Target Port</label>
                <input
                  type="number"
                  required
                  value={remotePort}
                  onChange={e => setRemotePort(parseInt(e.target.value, 10) || 0)}
                  placeholder="22"
                  className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono font-bold text-purple-300"
                />
              </div>
            </div>
          </div>
        )}

        {/* SSH Gateway Profile (Only shown when not direct proxy) */}
        {type !== 'direct' && (
          <div className="p-3 bg-[#0e1222] border border-white/5 rounded-lg space-y-2.5">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>3. Intermediate SSH Gateway Server</span>
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Select Saved SSH Server Profile</label>
              <select
                value={sshProfileId}
                onChange={e => setSshProfileId(e.target.value)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.username}@{p.host}:{p.port})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Auto-Start & Temporary Toggle */}
        <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
          <div>
            <div className="font-semibold text-white">Auto-Start on App Launch</div>
            <div className="text-[10px] text-slate-400">
              Leave OFF for on-demand / temporary port forwarding
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={e => setAutoStart(e.target.checked)}
            className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              setIsAddTunnelOpen(false);
              setEditingTunnel(null);
            }}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-bold shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>{editingTunnel ? 'Save Changes' : 'Create Forwarder'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
