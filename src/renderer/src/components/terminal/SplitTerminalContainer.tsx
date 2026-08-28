import React, { useRef, useState } from 'react';
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
    setSplitRatio,
    setActiveTabId,
    swapSplitTabs,
  } = useTerminal();

  const [isResizingSplit, setIsResizingSplit] = useState<'vertical' | 'horizontal' | null>(null);
  const verticalContainerRef = useRef<HTMLDivElement>(null);
  const horizontalContainerRef = useRef<HTMLDivElement>(null);

  const startVerticalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit('vertical');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const container = verticalContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        const ratio = (moveEvent.clientX - rect.left) / rect.width;
        setSplitRatio(ratio);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSplit(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startHorizontalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit('horizontal');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const container = horizontalContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.height > 0) {
        const ratio = (moveEvent.clientY - rect.top) / rect.height;
        setSplitRatio(ratio);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSplit(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (tabs.length === 0) {
    return <SessionLauncher />;
  }

  const isLauncherActive = activeTabId === null || !activeTab;

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
      {/* Multi-Exec Warning & Toolbar */}
      <MultiExecBanner />

      {/* Drag Overlay during split resizing */}
      {isResizingSplit && (
        <div
          className={`fixed inset-0 z-50 select-none ${
            isResizingSplit === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize'
          }`}
          style={{ pointerEvents: 'auto' }}
        />
      )}

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
            <div ref={verticalContainerRef} className="flex w-full h-full relative select-none">
              {/* Primary Left Pane */}
              <div
                className="h-full relative overflow-hidden"
                style={{ width: `${splitState.splitRatio * 100}%` }}
                onClick={() => setActiveTabId(activeTab.id)}
              >
                <div className="absolute top-1 left-2 z-20 px-2 py-0.5 rounded text-[10px] bg-black/60 text-cyan-400 font-mono border border-cyan-500/30">
                  {activeTab.title}
                </div>
                <XtermView tab={activeTab} isFocused={activeTab.id === activeTabId && !isLauncherActive} />
              </div>

              {/* Vertical Splitter Resizer Handle */}
              <div
                onMouseDown={startVerticalResize}
                onDoubleClick={() => setSplitRatio(0.5)}
                className="w-1.5 hover:w-2 -mx-0.5 z-30 cursor-col-resize bg-[var(--theme-border,#1e2640)] hover:bg-cyan-500/60 active:bg-cyan-400 transition-all flex items-center justify-center group select-none"
                title="Drag to resize split terminals (Double-click to reset 50/50)"
              >
                <div className="w-0.5 h-7 bg-slate-600 rounded-full group-hover:bg-cyan-300 group-hover:h-12 transition-all" />
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
                className="h-full relative flex-1 overflow-hidden"
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
            <div ref={horizontalContainerRef} className="flex flex-col w-full h-full relative select-none">
              {/* Primary Top Pane */}
              <div
                className="w-full relative overflow-hidden"
                style={{ height: `${splitState.splitRatio * 100}%` }}
                onClick={() => setActiveTabId(activeTab.id)}
              >
                <div className="absolute top-1 left-2 z-20 px-2 py-0.5 rounded text-[10px] bg-black/60 text-cyan-400 font-mono border border-cyan-500/30">
                  {activeTab.title}
                </div>
                <XtermView tab={activeTab} isFocused={activeTab.id === activeTabId && !isLauncherActive} />
              </div>

              {/* Horizontal Splitter Resizer Handle */}
              <div
                onMouseDown={startHorizontalResize}
                onDoubleClick={() => setSplitRatio(0.5)}
                className="h-1.5 hover:h-2 -my-0.5 z-30 cursor-row-resize bg-[var(--theme-border,#1e2640)] hover:bg-cyan-500/60 active:bg-cyan-400 transition-all flex items-center justify-center group select-none"
                title="Drag to resize split terminals (Double-click to reset 50/50)"
              >
                <div className="h-0.5 w-7 bg-slate-600 rounded-full group-hover:bg-cyan-300 group-hover:w-12 transition-all" />
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
                className="w-full relative flex-1 overflow-hidden"
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
