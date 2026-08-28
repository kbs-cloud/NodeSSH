import React from 'react';
import {
  Terminal,
  FolderTree,
  Server,
  Network,
  Key,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Radio,
} from 'lucide-react';
import { useApp, NavView } from '../../context/AppContext';
import { useTerminal } from '../../context/TerminalContext';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    profiles,
    keys,
    tunnels,
    snippets,
    lanIp,
  } = useApp();

  const { tabs, isMultiExecActive } = useTerminal();

  const activeTunnelsCount = tunnels.filter(t => t.status === 'active').length;

  const navItems: { id: NavView; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string }[] = [
    {
      id: 'terminals',
      label: 'Terminal Sessions',
      icon: <Terminal className="w-4 h-4" />,
      badge: tabs.length,
      badgeColor: 'bg-cyan-500/20 text-cyan-300',
    },
    {
      id: 'files',
      label: 'File Manager',
      icon: <FolderTree className="w-4 h-4" />,
    },
    {
      id: 'profiles',
      label: 'Server Profiles',
      icon: <Server className="w-4 h-4" />,
      badge: profiles.length,
    },
    {
      id: 'tunnels',
      label: 'SSH Tunnels',
      icon: <Network className="w-4 h-4" />,
      badge: activeTunnelsCount > 0 ? `${activeTunnelsCount} Live` : tunnels.length,
      badgeColor: activeTunnelsCount > 0 ? 'bg-emerald-500/20 text-emerald-400 font-bold animate-pulse' : undefined,
    },
    {
      id: 'keys',
      label: 'Key Vault',
      icon: <Key className="w-4 h-4" />,
      badge: keys.length,
    },
    {
      id: 'snippets',
      label: 'Snippet Library',
      icon: <Sparkles className="w-4 h-4" />,
      badge: snippets.length,
    },
  ];

  return (
    <aside
      className={`h-full bg-[var(--theme-bg-surface,#0e1222)] border-r border-[var(--theme-border,#1e2640)] flex flex-col justify-between select-none transition-all duration-200 z-20 ${
        isSidebarCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Top Nav List */}
      <div className="p-2 space-y-1">
        {navItems.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[var(--theme-bg-elevated,#151b30)] text-white border-l-2 border-[var(--theme-primary,#00f0ff)] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-2 border-transparent'
              }`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <div className={`${isActive ? 'text-[var(--theme-primary,#00f0ff)]' : 'text-slate-400'}`}>
                {item.icon}
              </div>

              {!isSidebarCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        item.badgeColor || 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Info & Collapse Button */}
      <div className="p-2 border-t border-[var(--theme-border,#1e2640)] space-y-2">
        {/* LAN IP Info Indicator */}
        {!isSidebarCollapsed && (
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Wifi className="w-3.5 h-3.5" />
              <span>LAN: {lanIp}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        )}

        {/* Multi-Exec Indicator */}
        {isMultiExecActive && !isSidebarCollapsed && (
          <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[10px] text-rose-300 flex items-center gap-1.5 font-semibold animate-pulse">
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Multi-Exec Active</span>
          </div>
        )}

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
