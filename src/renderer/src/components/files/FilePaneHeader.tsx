import React, { useState, useRef, useEffect } from 'react';
import {
  FolderTree,
  Monitor,
  Terminal,
  Server,
  ArrowUp,
  Home,
  RefreshCw,
  FolderPlus,
  Eye,
  EyeOff,
  Search,
  X,
  ChevronDown,
  ArrowRight,
  HardDrive,
  Plus,
  Send,
} from 'lucide-react';
import { FilePaneConfig, LocalDriveInfo, QuickLocation, ServerProfile, TerminalTab } from '../../types';

interface FilePaneHeaderProps {
  pane: FilePaneConfig;
  panes: FilePaneConfig[];
  profiles: ServerProfile[];
  terminalTabs: TerminalTab[];
  drives: LocalDriveInfo[];
  quickLocations: QuickLocation[];
  onUpdatePane: (updates: Partial<FilePaneConfig>) => void;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
  onCreateFolder: () => void;
  onClosePane?: () => void;
  onOpenDirectConnect: () => void;
  onQuickTransferTo?: (targetPaneId: string) => void;
}

export const FilePaneHeader: React.FC<FilePaneHeaderProps> = ({
  pane,
  panes,
  profiles,
  terminalTabs,
  drives,
  quickLocations,
  onUpdatePane,
  onNavigate,
  onRefresh,
  onCreateFolder,
  onClosePane,
  onOpenDirectConnect,
  onQuickTransferTo,
}) => {
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(pane.currentPath);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [isDriveDropdownOpen, setIsDriveDropdownOpen] = useState(false);
  const [isTransferDropdownOpen, setIsTransferDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const pathInputRef = useRef<HTMLInputElement>(null);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);
  const driveDropdownRef = useRef<HTMLDivElement>(null);
  const transferDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPathInput(pane.currentPath);
  }, [pane.currentPath]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(e.target as Node)) {
        setIsSessionDropdownOpen(false);
      }
      if (driveDropdownRef.current && !driveDropdownRef.current.contains(e.target as Node)) {
        setIsDriveDropdownOpen(false);
      }
      if (transferDropdownRef.current && !transferDropdownRef.current.contains(e.target as Node)) {
        setIsTransferDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      onNavigate(pathInput.trim());
      setIsEditingPath(false);
    }
  };

  const handleGoUp = () => {
    if (pane.sessionType === 'local') {
      const isWindows = pane.currentPath.includes('\\') || /^[A-Z]:/i.test(pane.currentPath);
      if (isWindows) {
        const parts = pane.currentPath.split(/[\\/]/).filter(Boolean);
        if (parts.length > 1) {
          parts.pop();
          const upPath = parts.join('\\') + (parts.length === 1 ? '\\' : '');
          onNavigate(upPath);
        }
      } else {
        const parts = pane.currentPath.split('/').filter(Boolean);
        parts.pop();
        const upPath = parts.length > 0 ? '/' + parts.join('/') : '/';
        onNavigate(upPath);
      }
    } else {
      const parts = pane.currentPath.split('/').filter(Boolean);
      parts.pop();
      const upPath = parts.length > 0 ? '/' + parts.join('/') : '/';
      onNavigate(upPath);
    }
  };

  // Breadcrumbs parsing
  const isLocalWindows = pane.sessionType === 'local' && (pane.currentPath.includes('\\') || /^[A-Z]:/i.test(pane.currentPath));
  const delimiter = isLocalWindows ? '\\' : '/';
  const pathSegments = pane.currentPath.split(isLocalWindows ? /[\\/]/ : '/').filter(Boolean);

  const otherPanes = panes.filter((p) => p.id !== pane.id);

  return (
    <div className="flex flex-col bg-[var(--theme-bg-surface,#0e1222)] border-b border-[var(--theme-border,#1e2640)] text-slate-200 select-none">
      {/* Top Bar: Session Info & Main Controls */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--theme-bg-dark,#070913)]/90 gap-2 min-w-0">
        {/* Session Selector Dropdown */}
        <div className="relative min-w-0 flex-1 flex items-center gap-1.5" ref={sessionDropdownRef}>
          <button
            onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-white/10 hover:border-cyan-500/50 text-xs font-medium text-slate-200 truncate transition-colors max-w-full"
            title="Change Session Source (Local Filesystem, Server Profile, or Terminal Tab)"
          >
            {pane.sessionType === 'local' ? (
              <Monitor className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : pane.sessionType === 'terminal' ? (
              <Terminal className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            ) : (
              <FolderTree className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            )}
            <span className="truncate font-semibold text-[11px]">{pane.title}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          </button>

          {/* Session Type Badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider hidden sm:inline flex-shrink-0 ${
              pane.sessionType === 'local'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : pane.sessionType === 'terminal'
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            {pane.sessionType === 'local' ? 'Local Disk' : pane.sessionType === 'terminal' ? 'SSH Shell' : 'SFTP Session'}
          </span>

          {/* Session Selection Dropdown Menu */}
          {isSessionDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-xl py-1 z-50 text-xs">
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Select Session Mode
              </div>

              {/* Local File System */}
              <button
                onClick={() => {
                  onUpdatePane({
                    sessionType: 'local',
                    title: 'Local Filesystem',
                    profileId: undefined,
                    profile: undefined,
                    terminalTabId: undefined,
                  });
                  setIsSessionDropdownOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 ${
                  pane.sessionType === 'local' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-200'
                }`}
              >
                <Monitor className="w-4 h-4 text-emerald-400" />
                <div className="flex-1 truncate">
                  <div className="font-semibold">Local Filesystem</div>
                  <div className="text-[10px] text-slate-400">Browse this computer</div>
                </div>
              </button>

              <div className="my-1 border-t border-white/5" />

              {/* Saved Profiles for Direct SFTP */}
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                <span>Standalone SFTP Profiles</span>
                <span className="text-[9px] text-cyan-400">No terminal shell</span>
              </div>
              {profiles.map((prof) => (
                <button
                  key={prof.id}
                  onClick={() => {
                    onUpdatePane({
                      sessionType: 'sftp',
                      title: prof.name,
                      profileId: prof.id,
                      profile: prof,
                      terminalTabId: undefined,
                      currentPath: prof.defaultPath || '/',
                    });
                    setIsSessionDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 ${
                    pane.sessionType === 'sftp' && pane.profileId === prof.id
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-200'
                  }`}
                >
                  <Server className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1 truncate">
                    <div className="font-semibold truncate">{prof.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {prof.username}@{prof.host}:{prof.port}
                    </div>
                  </div>
                </button>
              ))}

              {/* Active Terminal Tabs */}
              {terminalTabs.length > 0 && (
                <>
                  <div className="my-1 border-t border-white/5" />
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Active Terminal Tabs
                  </div>
                  {terminalTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        onUpdatePane({
                          sessionType: 'terminal',
                          title: `Tab: ${tab.title}`,
                          profileId: tab.profileId,
                          profile: tab.profile,
                          terminalTabId: tab.id,
                          currentPath: tab.cwd || tab.sftpPath || '/',
                        });
                        setIsSessionDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 ${
                        pane.sessionType === 'terminal' && pane.terminalTabId === tab.id
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'text-slate-200'
                      }`}
                    >
                      <Terminal className="w-4 h-4 text-purple-400" />
                      <div className="flex-1 truncate">
                        <div className="font-semibold truncate">{tab.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {tab.profile?.host || 'Local Shell'} ({tab.cwd || '~'})
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              <div className="my-1 border-t border-white/5" />

              {/* Connect to ad-hoc host */}
              <button
                onClick={() => {
                  setIsSessionDropdownOpen(false);
                  onOpenDirectConnect();
                }}
                className="w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-cyan-500/20 text-cyan-300 font-medium"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>+ Connect Standalone SFTP...</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Header Controls: Transfer to, Search Toggle, Close Pane */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Quick Transfer Target Dropdown (when other panes exist) */}
          {otherPanes.length > 0 && (
            <div className="relative" ref={transferDropdownRef}>
              <button
                onClick={() => setIsTransferDropdownOpen(!isTransferDropdownOpen)}
                className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Transfer selected items to another pane"
              >
                <Send className="w-3 h-3" />
                <span className="hidden md:inline text-[11px]">Transfer to...</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-70" />
              </button>

              {isTransferDropdownOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-xl py-1 z-50 text-xs">
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Target Destination Pane
                  </div>
                  {otherPanes.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setIsTransferDropdownOpen(false);
                        if (onQuickTransferTo) onQuickTransferTo(p.id);
                      }}
                      className="w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 text-slate-200"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                      <div className="flex-1 truncate">
                        <div className="font-semibold truncate">{p.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{p.currentPath}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search filter button */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 ${
              isSearchOpen || pane.searchFilter ? 'text-cyan-400 bg-cyan-500/10' : ''
            }`}
            title="Filter files"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Close pane button */}
          {onClosePane && (
            <button
              onClick={onClosePane}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Close this split pane"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Path Bar & Directory Action Bar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#12172b] border-t border-[var(--theme-border,#1e2640)]/70 text-xs">
        {/* Go Up button */}
        <button
          onClick={handleGoUp}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          title="Go Up One Directory"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Drives / Quick Locations Dropdown for Local */}
        {pane.sessionType === 'local' ? (
          <div className="relative" ref={driveDropdownRef}>
            <button
              onClick={() => setIsDriveDropdownOpen(!isDriveDropdownOpen)}
              className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-colors flex items-center gap-0.5 flex-shrink-0"
              title="Select Local Drive or Quick Folder"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {isDriveDropdownOpen && (
              <div className="absolute left-0 mt-1 w-48 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-xl py-1 z-50 text-xs">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Drives
                </div>
                {drives.map((d) => (
                  <button
                    key={d.path}
                    onClick={() => {
                      onNavigate(d.path);
                      setIsDriveDropdownOpen(false);
                    }}
                    className="w-full px-2.5 py-1 text-left flex items-center gap-2 hover:bg-white/10 text-slate-200"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{d.name}</span>
                  </button>
                ))}
                {quickLocations.length > 0 && (
                  <>
                    <div className="my-1 border-t border-white/5" />
                    <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Quick Locations
                    </div>
                    {quickLocations.map((loc) => (
                      <button
                        key={loc.path}
                        onClick={() => {
                          onNavigate(loc.path);
                          setIsDriveDropdownOpen(false);
                        }}
                        className="w-full px-2.5 py-1 text-left flex items-center gap-2 hover:bg-white/10 text-slate-200"
                      >
                        <Home className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{loc.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onNavigate(pane.profile?.defaultPath || '/')}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition-colors flex-shrink-0"
            title="Go to Default / Home Path"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Path Breadcrumbs / Direct Edit */}
        <div className="flex-1 min-w-0 bg-[#090b14] border border-white/10 rounded px-2 py-0.5 flex items-center gap-1 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/30">
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="flex items-center w-full gap-1">
              <input
                ref={pathInputRef}
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onBlur={() => {
                  if (pathInput.trim() !== pane.currentPath) {
                    onNavigate(pathInput.trim());
                  }
                  setIsEditingPath(false);
                }}
                autoFocus
                className="w-full bg-transparent border-none outline-none font-mono text-[11px] text-cyan-300 placeholder-slate-600"
                placeholder={pane.sessionType === 'local' ? 'C:\\path\\to\\folder' : '/path/to/remote/directory'}
              />
              <button type="submit" className="p-0.5 rounded text-cyan-400 hover:bg-cyan-900/40">
                <ArrowRight className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <div
              onClick={() => {
                setIsEditingPath(true);
                setTimeout(() => pathInputRef.current?.select(), 50);
              }}
              className="flex-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar font-mono text-[11px] cursor-text py-0.5"
              title="Click to type custom path"
            >
              {isLocalWindows ? (
                pathSegments.map((segment, idx) => {
                  const segPath = pathSegments.slice(0, idx + 1).join('\\');
                  const isLast = idx === pathSegments.length - 1;
                  return (
                    <React.Fragment key={segPath}>
                      {idx > 0 && <span className="text-slate-600">\</span>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(segPath + (idx === 0 ? '\\' : ''));
                        }}
                        className={`px-1 rounded hover:bg-white/10 truncate max-w-[120px] ${
                          isLast ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-cyan-400'
                        }`}
                      >
                        {segment}
                      </button>
                    </React.Fragment>
                  );
                })
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('/');
                    }}
                    className="hover:text-cyan-400 text-slate-400 font-semibold px-1 rounded hover:bg-white/10"
                  >
                    /
                  </button>
                  {pathSegments.map((segment, idx) => {
                    const segPath = '/' + pathSegments.slice(0, idx + 1).join('/');
                    const isLast = idx === pathSegments.length - 1;
                    return (
                      <React.Fragment key={segPath}>
                        <span className="text-slate-600">/</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(segPath);
                          }}
                          className={`px-1 rounded hover:bg-white/10 truncate max-w-[120px] ${
                            isLast ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-cyan-400'
                          }`}
                        >
                          {segment}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Toolbar action buttons: New Folder, Hidden, Refresh */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onCreateFolder}
            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
            title="Create New Folder in Current Directory"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onUpdatePane({ showHidden: !pane.showHidden })}
            className={`p-1 rounded transition-colors ${
              pane.showHidden ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={pane.showHidden ? 'Hide hidden dotfiles' : 'Show hidden dotfiles'}
          >
            {pane.showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onRefresh}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Search Filter Bar */}
      {(isSearchOpen || pane.searchFilter) && (
        <div className="flex items-center gap-2 px-3 py-1 bg-[#090b14] border-t border-white/5 text-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Filter files in current folder..."
            value={pane.searchFilter}
            onChange={(e) => onUpdatePane({ searchFilter: e.target.value })}
            className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-600 text-xs w-full font-mono"
            autoFocus
          />
          {pane.searchFilter && (
            <button
              onClick={() => onUpdatePane({ searchFilter: '' })}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
