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

  const { profiles } = useApp();

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
    <div className="flex items-center justify-between bg-[var(--theme-bg-surface,#0e1222)] border-b border-[var(--theme-border,#1e2640)] px-2 select-none h-10">
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
                  className="bg-black/50 text-white px-1 py-0.5 rounded border border-[var(--theme-primary,#00f0ff)] outline-none text-xs w-28"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={() => startRename(tab.id, tab.title)}
                  className="max-w-[140px] truncate"
                  title={`${tab.title} (Double-click to rename)`}
                >
                  {tab.title}
                </span>
              )}

              {/* Pin indicator */}
              {tab.isPinned && (
                <Pin className="w-3 h-3 text-[var(--theme-primary,#00f0ff)] opacity-80" />
              )}

              {/* Hover actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                {/* Pin toggle */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    pinTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:text-white hover:bg-white/10"
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

        {/* Add Tab Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="flex items-center gap-1 p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="New Terminal Tab"
          >
            <Plus className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isAddMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
              <div className="absolute top-8 left-0 z-50 w-56 p-1 bg-[var(--theme-bg-elevated,#151b30)] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-2xl text-xs">
                <button
                  onClick={() => {
                    addTab({ title: 'Local Shell' });
                    setIsAddMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left rounded hover:bg-white/10 text-slate-200"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>New Local Shell</span>
                </button>

                <div className="my-1 border-t border-white/10" />
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Saved Profiles
                </div>

                {profiles.slice(0, 5).map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addTab({ profile: p });
                      setIsAddMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left rounded hover:bg-white/10 text-slate-200"
                  >
                    <Server className="w-3.5 h-3.5 text-[var(--theme-primary,#00f0ff)]" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right side controls: Multi-Exec, Split, SFTP */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
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
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Single View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSplitMode('vertical')}
            className={`p-1 rounded transition-colors ${
              splitState.mode === 'vertical'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Vertical Split (Left / Right)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSplitMode('horizontal')}
            className={`p-1 rounded transition-colors ${
              splitState.mode === 'horizontal'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Horizontal Split (Top / Bottom)"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SFTP Drawer Toggle */}
        <button
          onClick={toggleSftpDock}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            isSftpDocked
              ? 'bg-[var(--theme-primary,#00f0ff)]/20 text-[var(--theme-primary,#00f0ff)] border border-[var(--theme-primary,#00f0ff)]/40 font-medium'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle SFTP Side Explorer"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden md:inline">SFTP</span>
        </button>
      </div>
    </div>
  );
};
