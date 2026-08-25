import React from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { XtermView } from './XtermView';
import { MultiExecBanner } from './MultiExecBanner';
import { ArrowLeftRight, Terminal, Plus, Server, Key, Network } from 'lucide-react';

export const SplitTerminalContainer: React.FC = () => {
  const {
    tabs,
    activeTabId,
    activeTab,
    secondaryTab,
    splitState,
    setActiveTabId,
    swapSplitTabs,
    addTab,
  } = useTerminal();

  const { setActiveView, setIsProfileModalOpen, profiles } = useApp();

  if (tabs.length === 0 || !activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--theme-bg-dark,#070913)] text-slate-400 p-8 select-none">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-500/10">
            <Terminal className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white tracking-wide">No Active Terminal Sessions</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect to a remote server, start a local shell, or configure SSH tunnels to begin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {profiles.length > 0 ? (
              <button
                onClick={() => addTab({ profile: profiles[0] })}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-md transition-all group"
              >
                <Server className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="truncate">Connect {profiles[0].name}</span>
              </button>
            ) : (
              <button
                onClick={() => addTab({ title: 'Local Shell' })}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 text-white text-xs font-semibold shadow-md transition-all group"
              >
                <Plus className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>New Local Shell</span>
              </button>
            )}

            <button
              onClick={() => {
                setActiveView('profiles');
                setIsProfileModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 text-white text-xs font-semibold shadow-md transition-all group"
            >
              <Server className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>Add SSH Server</span>
            </button>

            <button
              onClick={() => setActiveView('keys')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 text-slate-300 text-xs font-medium shadow-md transition-all group"
            >
              <Key className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>SSH Key Vault</span>
            </button>

            <button
              onClick={() => setActiveView('tunnels')}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 text-slate-300 text-xs font-medium shadow-md transition-all group"
            >
              <Network className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>SSH Tunnels</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
      {/* Multi-Exec Warning & Toolbar */}
      <MultiExecBanner />

      {/* Main Terminal Viewport */}
      <div className="flex-1 relative w-full h-full overflow-hidden bg-[var(--theme-bg-dark,#070913)]">
        {splitState.mode === 'single' || !secondaryTab ? (
          // Single Pane Mode: keep all open tabs mounted so sessions never disconnect
          <div className="w-full h-full relative">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`w-full h-full ${tab.id === activeTabId ? 'block' : 'hidden'}`}
              >
                <XtermView tab={tab} isFocused={tab.id === activeTabId} />
              </div>
            ))}
          </div>
        ) : splitState.mode === 'vertical' ? (
          // Vertical Split (Left / Right)
          <div className="flex w-full h-full relative">
            {/* Primary Left Pane */}
            <div
              className="h-full relative border-r border-[var(--theme-border,#1e2640)]"
              style={{ width: `${splitState.splitRatio * 100}%` }}
              onClick={() => setActiveTabId(activeTab.id)}
            >
              <div className="absolute top-1 left-2 z-20 px-2 py-0.5 rounded text-[10px] bg-black/60 text-cyan-400 font-mono border border-cyan-500/30">
                {activeTab.title}
              </div>
              <XtermView tab={activeTab} isFocused={activeTab.id === activeTabId} />
            </div>

            {/* Split controls */}
            <button
              onClick={swapSplitTabs}
              className="absolute left-1/2 top-2 -translate-x-1/2 z-30 p-1 rounded-full bg-[#151b30] border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 shadow-md transition-transform active:scale-95"
              title="Swap split panes"
            >
              <ArrowLeftRight className="w-3 h-3" />
            </button>

            {/* Secondary Right Pane */}
            <div
              className="h-full relative flex-1"
              onClick={() => setActiveTabId(secondaryTab.id)}
            >
              <div className="absolute top-1 left-2 z-20 px-2 py-0.5 rounded text-[10px] bg-black/60 text-purple-400 font-mono border border-purple-500/30">
                {secondaryTab.title}
              </div>
              <XtermView tab={secondaryTab} isFocused={secondaryTab.id === activeTabId} />
            </div>

            {/* Hidden background tabs */}
            <div className="hidden">
              {tabs
                .filter(t => t.id !== activeTab.id && t.id !== secondaryTab.id)
                .map(tab => (
                  <XtermView key={tab.id} tab={tab} isFocused={false} />
                ))}
            </div>
          </div>
        ) : (
          // Horizontal Split (Top / Bottom)
          <div className="flex flex-col w-full h-full relative">
            {/* Primary Top Pane */}
            <div
              className="w-full relative border-b border-[var(--theme-border,#1e2640)]"
              style={{ height: `${splitState.splitRatio * 100}%` }}
              onClick={() => setActiveTabId(activeTab.id)}
            >
              <div className="absolute top-1 left-2 z-20 px-2 py-0.5 rounded text-[10px] bg-black/60 text-cyan-400 font-mono border border-cyan-500/30">
                {activeTab.title}
              </div>
              <XtermView tab={activeTab} isFocused={activeTab.id === activeTabId} />
            </div>

            {/* Split controls */}
            <button
              onClick={swapSplitTabs}
              className="absolute top-1/2 right-4 -translate-y-1/2 z-30 p-1 rounded-full bg-[#151b30] border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 shadow-md transition-transform active:scale-95"
              title="Swap split panes"
            >
              <ArrowLeftRight className="w-3 h-3 rotate-90" />
            </button>

            {/* Secondary Bottom Pane */}
            <div
              className="w-full relative flex-1"
              onClick={() => setActiveTabId(secondaryTab.id)}
            >
              <div className="absolute top-1 left-2 z-20 px-2 py-0.5 rounded text-[10px] bg-black/60 text-purple-400 font-mono border border-purple-500/30">
                {secondaryTab.title}
              </div>
              <XtermView tab={secondaryTab} isFocused={secondaryTab.id === activeTabId} />
            </div>

            {/* Hidden background tabs */}
            <div className="hidden">
              {tabs
                .filter(t => t.id !== activeTab.id && t.id !== secondaryTab.id)
                .map(tab => (
                  <XtermView key={tab.id} tab={tab} isFocused={false} />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
