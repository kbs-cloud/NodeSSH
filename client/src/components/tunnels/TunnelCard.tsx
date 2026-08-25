import React, { useState } from 'react';
import { Play, Square, Edit, Trash2, Copy, Check, ShieldCheck, Zap } from 'lucide-react';
import { SSHTunnel } from '../../types';
import { useApp } from '../../context/AppContext';
import { TopologyDiagram } from './TopologyDiagram';

interface TunnelCardProps {
  tunnel: SSHTunnel;
}

export const TunnelCard: React.FC<TunnelCardProps> = ({ tunnel }) => {
  const { toggleTunnel, setEditingTunnel, setIsAddTunnelOpen, deleteTunnel, lanIp, showToast } = useApp();
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const isActive = tunnel.status === 'active';

  const typeBadges = {
    bridge: { label: 'Local SSH Bridge', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    direct: { label: 'Node TCP Proxy', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
    local: { label: 'Local Forward (-L)', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
    remote: { label: 'Remote Forward (-R)', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
    socks5: { label: 'Dynamic SOCKS5 (-D)', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  };

  const badge = typeBadges[tunnel.type] || typeBadges.bridge;

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await toggleTunnel(tunnel.id, !isActive);
    } finally {
      setIsToggling(false);
    }
  };

  const formatUptime = (secs: number) => {
    if (secs === 0) return '0s';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${s}s`;
    if (mins > 0) return `${mins}m ${s}s`;
    return `${s}s`;
  };

  const getConnectionString = () => {
    if (tunnel.type === 'bridge') {
      const host = tunnel.bindHost === '0.0.0.0' ? lanIp : 'localhost';
      return `ssh -p ${tunnel.bindPort} ${host}`;
    }
    if (tunnel.type === 'socks5') {
      return `socks5://${tunnel.bindHost === '0.0.0.0' ? lanIp : '127.0.0.1'}:${tunnel.bindPort}`;
    }
    return `${tunnel.bindHost === '0.0.0.0' ? lanIp : '127.0.0.1'}:${tunnel.bindPort}`;
  };

  const copyConnectionString = () => {
    navigator.clipboard.writeText(getConnectionString());
    setCopied(true);
    showToast(`Copied connection endpoint: ${getConnectionString()}`, 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 flex flex-col gap-3 shadow-lg ${
      isActive
        ? 'bg-[#0e1222] border-cyan-500/40 shadow-cyan-950/30'
        : 'bg-[#0b0e18] border-white/10 opacity-80 hover:opacity-100'
    }`}>
      {/* Top row: Name, Badge, Start/Stop toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
          }`} />
          <h3 className="font-semibold text-sm text-white">{tunnel.name}</h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyConnectionString}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 border border-white/10 text-xs font-mono text-slate-300 transition-colors"
            title="Copy connection endpoint"
          >
            <span>{getConnectionString()}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
              isActive
                ? 'bg-rose-600/80 hover:bg-rose-600 text-white border border-rose-500/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50'
            }`}
          >
            {isActive ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Start</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setEditingTunnel(tunnel);
              setIsAddTunnelOpen(true);
            }}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10"
            title="Edit Tunnel"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              if (window.confirm(`Delete tunnel "${tunnel.name}"?`)) {
                deleteTunnel(tunnel.id);
              }
            }}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            title="Delete Tunnel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Topology Diagram */}
      <TopologyDiagram tunnel={tunnel} lanIp={lanIp} />

      {/* Footer stats & metadata */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
        <div className="flex items-center gap-4">
          <span>
            SSH Host: <strong className="text-slate-200 font-mono">{tunnel.sshUser}@{tunnel.sshHost}:{tunnel.sshPort}</strong>
          </span>
          {tunnel.jumpHostId && (
            <span className="flex items-center gap-1 text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              JumpHost Bastion Chained
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>
            Uptime: <strong className="text-slate-200 font-mono">{formatUptime(tunnel.uptimeSeconds)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
