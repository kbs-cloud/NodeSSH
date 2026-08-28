import React from 'react';
import { SSHTunnel } from '../../types';
import { Laptop, Server, Globe, Database, ArrowRight, Zap, Shield } from 'lucide-react';

interface TopologyDiagramProps {
  tunnel: SSHTunnel;
  lanIp?: string;
}

export const TopologyDiagram: React.FC<TopologyDiagramProps> = ({ tunnel, lanIp = '127.0.0.1' }) => {
  const isLanBind = tunnel.bindHost === '0.0.0.0';
  const isActive = tunnel.status === 'active';
  const isDirect = tunnel.type === 'direct';
  const isBridge = tunnel.type === 'bridge';

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[11px] select-none">
      {isBridge ? (
        // Inbound SSH Bridge Topology
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Node 1: Local Terminal */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Laptop className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-semibold text-white">Local Terminal</div>
              <div className="text-[10px] text-cyan-300 font-bold">
                ssh -p {tunnel.bindPort} {isLanBind ? lanIp : 'localhost'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-cyan-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 2: NodeSSH Inbound Bridge */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-cyan-500/40 text-cyan-300">
            <Shield className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-semibold text-white">NodeSSH Bridge</div>
              <div className="text-[10px] text-slate-400">
                Auto-Auth with Vault Keys
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-purple-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 3: Remote SSH Server */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Server className="w-4 h-4 text-purple-400" />
            <div>
              <div className="font-semibold text-white">Target SSH Server</div>
              <div className="text-[10px] text-purple-300">
                {tunnel.sshUser ? `${tunnel.sshUser}@` : ''}{tunnel.remoteHost || tunnel.sshHost}:{tunnel.remotePort || 22}
              </div>
            </div>
          </div>
        </div>
      ) : isDirect ? (
        // Direct Node TCP Proxy Topology
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Node 1: Client / App */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Laptop className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-semibold text-white">Local App / Client</div>
              <div className="text-[10px] text-slate-400">
                {isLanBind ? `${lanIp}:${tunnel.bindPort}` : `127.0.0.1:${tunnel.bindPort}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-cyan-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 2: Node Local Proxy */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-emerald-500/30 text-emerald-300">
            <Zap className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-semibold text-white">Node Local Proxy</div>
              <div className="text-[10px] text-emerald-400/80">
                Port {tunnel.bindPort}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-emerald-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 3: Target Service */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Server className="w-4 h-4 text-purple-400" />
            <div>
              <div className="font-semibold text-white">Remote Target</div>
              <div className="text-[10px] text-slate-400">
                {tunnel.remoteHost}:{tunnel.remotePort}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // SSH Encapsulated Tunnel Topology
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Node 1: Client / LAN Device */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Laptop className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-semibold text-white">Client / LAN</div>
              <div className="text-[10px] text-slate-400">
                {isLanBind ? `${lanIp}:${tunnel.bindPort}` : `127.0.0.1:${tunnel.bindPort}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-cyan-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 2: NodeSSH Gateway */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Server className="w-4 h-4 text-purple-400" />
            <div>
              <div className="font-semibold text-white">NodeSSH Gateway</div>
              <div className="text-[10px] text-slate-400">
                {tunnel.bindHost}:{tunnel.bindPort}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-purple-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 3: Remote SSH Server */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Globe className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-semibold text-white">SSH Server</div>
              <div className="text-[10px] text-slate-400">
                {tunnel.sshUser || 'user'}@{tunnel.sshHost || 'gateway'}:{tunnel.sshPort || 22}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <ArrowRight className={`w-4 h-4 ${isActive ? 'text-emerald-400 animate-pulse' : ''}`} />
          </div>

          {/* Node 4: Destination Service */}
          <div className="flex items-center gap-1.5 p-2 rounded bg-[#0e1222] border border-white/10 text-slate-300">
            <Database className="w-4 h-4 text-amber-400" />
            <div>
              <div className="font-semibold text-white">Target Service</div>
              <div className="text-[10px] text-slate-400">
                {tunnel.type === 'socks5' ? 'Dynamic SOCKS5' : `${tunnel.remoteHost}:${tunnel.remotePort}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Traffic activity bar */}
      {isActive && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              In: <strong className="text-cyan-400 font-mono">{formatBytes(tunnel.bytesIn)}</strong>
            </span>
            <span>
              Out: <strong className="text-purple-400 font-mono">{formatBytes(tunnel.bytesOut)}</strong>
            </span>
            <span>
              Clients: <strong className="text-emerald-400 font-mono">{tunnel.activeClients}</strong>
            </span>
          </div>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Forwarding active</span>
          </span>
        </div>
      )}
    </div>
  );
};
