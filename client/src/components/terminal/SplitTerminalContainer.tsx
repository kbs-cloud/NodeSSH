import React from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { XtermView } from './XtermView';
import { MultiExecBanner } from './MultiExecBanner';
import { SessionLauncher } from './SessionLauncher';
import { ArrowLeftRight } from 'lucide-react';

export const SplitTerminalContainer: React.FC = () => {
  const {
    tabs,
    activeTabId,
    activeTab,
    secondaryTab,
    splitState,
    setActiveTabId,
    swapSplitTabs,
  } = useTerminal();

  if (tabs.length === 0) {
    return <SessionLauncher />;
  }

  const isLauncherActive = activeTabId === null || !activeTab;

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
      {/* Multi-Exec Warning & Toolbar */}
      <MultiExecBanner />

      {/* Main Terminal Viewport */}
      <div className="flex-1 relative w-full h-full overflow-hidden bg-[var(--theme-bg-dark,#070913)]">
        {/* Session Launcher view when activeTabId is null */}
        <div className={`w-full h-full ${isLauncherActive ? 'block' : 'hidden'}`}>
          <SessionLauncher />
        </div>

        {/* Tab Viewports (kept mounted when launcher is open so PTY sessions never disconnect) */}
        <div className={`w-full h-full ${!isLauncherActive ? 'block' : 'hidden'}`}>
          {splitState.mode === 'single' || !secondaryTab ? (
            // Single Pane Mode: keep all open tabs mounted so sessions never disconnect
            <div className="w-full h-full relative">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`w-full h-full ${tab.id === activeTabId ? 'block' : 'hidden'}`}
                >
                  <XtermView tab={tab} isFocused={tab.id === activeTabId && !isLauncherActive} />
                </div>
              ))}
            </div>
          ) : splitState.mode === 'vertical' && activeTab && secondaryTab ? (
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
                <XtermView tab={activeTab} isFocused={activeTab.id === activeTabId && !isLauncherActive} />
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
                <XtermView tab={secondaryTab} isFocused={secondaryTab.id === activeTabId && !isLauncherActive} />
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
          ) : activeTab && secondaryTab ? (
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
                <XtermView tab={activeTab} isFocused={activeTab.id === activeTabId && !isLauncherActive} />
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
                <XtermView tab={secondaryTab} isFocused={secondaryTab.id === activeTabId && !isLauncherActive} />
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
          ) : null}
        </div>
      </div>
    </div>
  );
};
