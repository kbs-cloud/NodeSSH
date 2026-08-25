import React, { useState } from 'react';
import {
  Plus,
  X,
  Copy,
  Pin,
  PinOff,
  Columns,
  Rows,
  Maximize2,
  Radio,
  FolderTree,
  Server,
  ChevronDown,
} from 'lucide-react';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';

export const TerminalTabsHeader: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    addTab,
    closeTab,
    duplicateTab,
    renameTab,
    pinTab,
    splitState,
    setSplitMode,
    isMultiExecActive,
    toggleMultiExec,
    isSftpDocked,
    toggleSftpDock,
  } = useTerminal();

  const { profiles, setIsProfileModalOpen } = useApp();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);

  const startRename = (id: string, currentTitle: string) => {
    setEditingTabId(id);
    setEditTitle(currentTitle);
  };

  const commitRename = (id: string) => {
    if (editTitle.trim()) {
      renameTab(id, editTitle.trim());
    }
    setEditingTabId(null);
  };

  // Sort pinned tabs first
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  return (
    <div className="flex items-center justify-between bg-[var(--theme-bg-surface,#0e1222)] border-b border-[var(--theme-border,#1e2640)] px-2 select-none h-10 relative">
      {/* Tabs strip */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 h-full py-1 pr-2 no-scrollbar">
        {sortedTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isSecondary = tab.id === splitState.secondaryTabId;

          const statusColors = {
            connected: 'bg-emerald-400',
            connecting: 'bg-amber-400 animate-pulse',
            disconnected: 'bg-slate-500',
            error: 'bg-rose-500',
          };

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1 text-xs rounded-t-md transition-all cursor-pointer h-full border-t-2 ${
                isActive
                  ? 'bg-[var(--theme-bg-dark,#070913)] text-white border-[var(--theme-primary,#00f0ff)] font-medium shadow-sm'
                  : isSecondary
                  ? 'bg-[var(--theme-bg-elevated,#151b30)] text-slate-200 border-[var(--theme-accent,#9d4edf)]'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {/* Status Indicator */}
              <span
                className={`w-2 h-2 rounded-full ${statusColors[tab.status] || 'bg-slate-500'}`}
                title={`Status: ${tab.status}`}
              />

              {/* Tab Title or Input */}
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(tab.id);
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="bg-black/40 text-white px-1 py-0.5 rounded outline-none border border-cyan-500 text-xs w-28"
                />
              ) : (
                <span
                  onDoubleClick={e => {
                    e.stopPropagation();
                    startRename(tab.id, tab.title);
                  }}
                  className="truncate max-w-[140px]"
                  title={`${tab.title} (Double-click to rename)`}
                >
                  {tab.title}
                </span>
              )}

              {/* Action Buttons: Pin, Duplicate, Close */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                {/* Pin tab */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    pinTab(tab.id);
                  }}
                  className={`p-0.5 rounded hover:text-white ${
                    tab.isPinned ? 'text-amber-400' : 'text-slate-400 hover:bg-white/10'
                  }`}
                  title={tab.isPinned ? 'Unpin tab' : 'Pin tab'}
                >
                  {tab.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>

                {/* Duplicate tab */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    duplicateTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:text-white hover:bg-white/10"
                  title="Duplicate tab"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {/* Close Tab */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:text-rose-400 hover:bg-rose-500/10"
                  title="Close tab (kill session)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Tab Button & Dropdown (Positioned outside overflow container) */}
      <div className="relative flex items-center bg-[#070913]/60 rounded border border-white/10 mx-1.5 my-1 shrink-0">
        <button
          onClick={() => {
            if (activeTabId) {
              duplicateTab(activeTabId);
            } else if (profiles.length > 0) {
              addTab({ profile: profiles[0] });
            } else {
              addTab();
            }
          }}
          className="flex items-center p-1.5 hover:bg-white/10 text-slate-300 hover:text-cyan-400 transition-colors"
          title={activeTabId ? "Duplicate Current Session (+)" : "New Terminal Tab (+)"}
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          className="flex items-center p-1.5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border-l border-white/10"
          title="Open Other Profile or Shell"
        >
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>

        {isAddMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
            <div className="absolute top-9 left-0 z-50 w-64 p-1.5 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-2xl text-xs space-y-1">
              {activeTabId && (
                <button
                  onClick={() => {
                    duplicateTab(activeTabId);
                    setIsAddMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left rounded-md hover:bg-cyan-500/10 text-cyan-300 font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <div className="truncate">
                    <div>Duplicate Current Session</div>
                    <div className="text-[10px] text-cyan-500/70 font-mono truncate">
                      {tabs.find(t => t.id === activeTabId)?.title}
                    </div>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  addTab({ title: 'Local Shell', profile: undefined });
                  setIsAddMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left rounded-md hover:bg-white/10 text-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>New Local Shell</span>
              </button>

              <div className="my-1 border-t border-white/10" />

              <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Saved Profiles ({profiles.length})</span>
                <button
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="text-cyan-400 hover:underline normal-case text-[10px]"
                >
                  + Add New
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {profiles.length === 0 ? (
                  <div className="px-2.5 py-2 text-slate-500 text-center text-[11px]">
                    No saved profiles yet
                  </div>
                ) : (
                  profiles.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addTab({ profile: p });
                        setIsAddMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-md hover:bg-white/10 text-slate-200 group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Server
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: p.colorTag || '#00f0ff' }}
                        />
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {p.username}@{p.host}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right side controls: Multi-Exec, Split, SFTP */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 shrink-0">
        {/* Multi-Exec Toggle */}
        <button
          onClick={toggleMultiExec}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-all ${
            isMultiExecActive
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Multi-Exec / Broadcast Input Mode: Send commands to all open sessions"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Multi-Exec</span>
        </button>

        {/* Split View Controls */}
        <div className="flex items-center bg-black/30 border border-white/5 rounded p-0.5">
          <button
            onClick={() => setSplitMode('single')}
            className={`p-1 rounded transition-colors ${
              splitState.mode === 'single'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Single Terminal View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSplitMode('vertical')}
            className={`p-1 rounded transition-colors ${
              splitState.mode === 'vertical'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Split Vertically (Side-by-Side)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSplitMode('horizontal')}
            className={`p-1 rounded transition-colors ${
              splitState.mode === 'horizontal'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Split Horizontally (Stacked)"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SFTP Dock Toggle */}
        <button
          onClick={toggleSftpDock}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            isSftpDocked
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle Docked SFTP Explorer Panel"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">SFTP</span>
        </button>
      </div>
    </div>
  );
};
