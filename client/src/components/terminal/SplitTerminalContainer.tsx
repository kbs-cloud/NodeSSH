import React from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { XtermView } from './XtermView';
import { MultiExecBanner } from './MultiExecBanner';
import { ArrowLeftRight } from 'lucide-react';

export const SplitTerminalContainer: React.FC = () => {
  const {
    activeTab,
    secondaryTab,
    splitState,
    setActiveTabId,
    swapSplitTabs,
  } = useTerminal();

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--theme-bg-dark,#070913)] text-slate-500">
        No active terminal tab
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
          // Single Pane
          <div className="w-full h-full">
            <XtermView key={activeTab.id} tab={activeTab} isFocused={true} />
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
              <XtermView key={activeTab.id} tab={activeTab} isFocused={true} />
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
              <XtermView key={secondaryTab.id} tab={secondaryTab} isFocused={false} />
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
              <XtermView key={activeTab.id} tab={activeTab} isFocused={true} />
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
              <XtermView key={secondaryTab.id} tab={secondaryTab} isFocused={false} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
