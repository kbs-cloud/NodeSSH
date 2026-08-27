import React, { useState } from 'react';
import { Network, Plus, Search, Filter, ShieldCheck, Activity, Users, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TunnelCard } from './TunnelCard';
import { LanHelperBanner } from './LanHelperBanner';
import { AddTunnelModal } from './AddTunnelModal';

export const TunnelDashboard: React.FC = () => {
  const { tunnels, setIsAddTunnelOpen, setEditingTunnel } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bridge' | 'direct' | 'local' | 'remote' | 'socks5'>('all');

  const activeTunnels = tunnels.filter(t => t.status === 'active');
  const totalClients = tunnels.reduce((sum, t) => sum + (t.status === 'active' ? t.activeClients : 0), 0);
  const totalBytes = tunnels.reduce((sum, t) => sum + t.bytesIn + t.bytesOut, 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredTunnels = tunnels.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.remoteHost.toLowerCase().includes(search.toLowerCase()) && !String(t.bindPort).includes(search)) return false;
    return true;
  });

  return (
    <div className="flex-1 h-full overflow-y-auto p-5 bg-[var(--theme-bg-dark,#070913)] space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Network className="w-6 h-6 text-cyan-400" />
            Local SSH Bridges, TCP Relays & Tunnels
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inbound SSH Bridges (auto-authenticated with Vault keys), direct TCP relays, and encapsulated SSH tunnels
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTunnel(null);
            setIsAddTunnelOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-bold text-xs shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Bridge / Tunnel</span>
        </button>
      </div>

      {/* LAN Sharing Helper */}
      <LanHelperBanner />

      {/* Metrics Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)]">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Bridges / Tunnels</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{activeTunnels.length}</span>
            <span className="text-xs text-slate-500">/ {tunnels.length} configured</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)]">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Connected Clients</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-300 font-mono">{totalClients}</span>
            <span className="text-xs text-slate-500">active sessions</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)]">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Data Routed</span>
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-300 font-mono">{formatBytes(totalBytes)}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)]">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Relay Core</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xs font-semibold text-emerald-400">SSH2 Server & Client Core</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search bridges & tunnels by name, port, or host..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-slate-500 w-full font-mono text-xs"
          />
        </div>

        <div className="flex items-center bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg p-1 text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'bridge', label: '🌉 SSH Bridge' },
            { id: 'direct', label: '⚡ Direct TCP' },
            { id: 'local', label: '🔒 SSH Local (-L)' },
            { id: 'remote', label: '🔄 SSH Remote (-R)' },
            { id: 'socks5', label: '🌐 SOCKS5 (-D)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id as any)}
              className={`px-3 py-1 rounded-md transition-colors ${
                typeFilter === f.id
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tunnels Grid */}
      {filteredTunnels.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/20 text-slate-500 text-xs">
          No tunnels match your filter criteria. Click &quot;New SSH Tunnel&quot; to configure one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTunnels.map(tunnel => (
            <TunnelCard key={tunnel.id} tunnel={tunnel} />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddTunnelModal />
    </div>
  );
};
