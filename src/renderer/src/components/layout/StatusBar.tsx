import React from 'react';
import {
  Terminal,
  Activity,
  Radio,
  Wifi,
  Server,
  Folder,
  Layers,
} from 'lucide-react';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';

export const StatusBar: React.FC = () => {
  const { tabs, activeTab, isMultiExecActive, splitState } = useTerminal();
  const { lanIp, tunnels } = useApp();

  const connectedCount = tabs.filter(t => t.status === 'connected').length;
  const activeTunnelsCount = tunnels.filter(t => t.status === 'active').length;

  return (
    <footer className="h-7 bg-[var(--theme-bg-dark,#070913)] border-t border-[var(--theme-border,#1e2640)] px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none z-30">
      {/* Left items: Active tabs & Multi-Exec */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>{connectedCount} / {tabs.length} Sessions</span>
        </div>

        {isMultiExecActive && (
          <div className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>BROADCAST ALL</span>
          </div>
        )}

        {splitState.mode !== 'single' && (
          <div className="hidden sm:flex items-center gap-1 text-purple-400">
            <Layers className="w-3 h-3" />
            <span>Split ({splitState.mode})</span>
          </div>
        )}

        {activeTunnelsCount > 0 && (
          <div className="hidden md:flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeTunnelsCount} Tunnels Live</span>
          </div>
        )}
      </div>

      {/* Center items: Active Session Host & CWD */}
      {activeTab && (
        <div className="hidden md:flex items-center gap-3 text-slate-300 truncate max-w-md">
          {activeTab.profile?.host && (
            <div className="flex items-center gap-1 text-cyan-300 truncate">
              <Server className="w-3 h-3 text-cyan-400" />
              <span>{activeTab.profile.username || 'user'}@{activeTab.profile.host}:{activeTab.profile.port || 22}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-slate-400 truncate">
            <Folder className="w-3 h-3 text-amber-400" />
            <span className="truncate">{activeTab.cwd || '~'}</span>
          </div>
        </div>
      )}

      {/* Right items: Latency, Dimensions, Encoding, LAN */}
      <div className="flex items-center gap-3">
        {/* Latency */}
        {activeTab && (
          <div className="flex items-center gap-1 text-slate-300">
            <span className={`w-1.5 h-1.5 rounded-full ${
              (activeTab.latencyMs || 10) < 50 ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
            <span>{activeTab.latencyMs || 12}ms</span>
          </div>
        )}

        {/* Terminal Geometry */}
        {activeTab && (
          <span className="hidden sm:inline text-slate-500">
            {activeTab.cols || 80}x{activeTab.rows || 24}
          </span>
        )}

        {/* Charset */}
        <span className="hidden lg:inline text-slate-500">UTF-8</span>

        {/* Local IP */}
        <div className="hidden sm:flex items-center gap-1 text-slate-400">
          <Wifi className="w-3 h-3 text-cyan-400" />
          <span>{lanIp}</span>
        </div>
      </div>
    </footer>
  );
};
