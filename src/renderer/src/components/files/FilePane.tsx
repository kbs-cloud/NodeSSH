import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree,
  Monitor,
  Terminal,
  Server,
  Plus,
} from 'lucide-react';
import { SFTPFileItem, FilePaneConfig, LocalDriveInfo, QuickLocation, ServerProfile, TerminalTab } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { FilePaneHeader } from './FilePaneHeader';
import { FilePaneList } from './FilePaneList';

interface FilePaneProps {
  pane: FilePaneConfig;
  panes: FilePaneConfig[];
  profiles: ServerProfile[];
  terminalTabs: TerminalTab[];
  drives: LocalDriveInfo[];
  quickLocations: QuickLocation[];
  onUpdatePane: (paneId: string, updates: Partial<FilePaneConfig>) => void;
  onClosePane?: () => void;
  onOpenDirectConnect: () => void;
  onInitiateTransfer: (sourcePane: FilePaneConfig, targetPane: FilePaneConfig, items: SFTPFileItem[], targetSubdir?: string) => void;
}

export const FilePane: React.FC<FilePaneProps> = ({
  pane,
  panes,
  profiles,
  terminalTabs,
  drives,
  quickLocations,
  onUpdatePane,
  onClosePane,
  onOpenDirectConnect,
  onInitiateTransfer,
}) => {
  const { showToast } = useApp();

  const [files, setFiles] = useState<SFTPFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Load files based on session type
  const loadFiles = useCallback(async (targetPath?: string | any) => {
    if (pane.sessionType === 'unassigned') {
      setFiles([]);
      return;
    }

    const pathToQuery = typeof targetPath === 'string' ? targetPath : pane.currentPath;
    setIsLoading(true);
    try {
      if (pane.sessionType === 'local') {
        const list = await api.listLocalFiles(pathToQuery);
        setFiles(list);
        if (list.resolvedPath && list.resolvedPath !== pane.currentPath) {
          onUpdatePane(pane.id, { currentPath: list.resolvedPath });
        }
      } else {
        // SFTP or attached Terminal Tab
        const list = await api.listSftpFiles(pathToQuery, pane.profile);
        setFiles(list);
        if (list.resolvedPath && list.resolvedPath !== pane.currentPath) {
          onUpdatePane(pane.id, { currentPath: list.resolvedPath });
        }
      }
    } catch (err: any) {
      setFiles([]);
      showToast(err.message || 'Failed to load directory files', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [pane.id, pane.sessionType, pane.currentPath, pane.profile, onUpdatePane, showToast]);

  useEffect(() => {
    if (pane.sessionType !== 'unassigned') {
      loadFiles();
    }
  }, [pane.sessionType, pane.profileId, pane.currentPath, pane.terminalTabId, pane.refreshKey]);

  const handleNavigate = (newPath: string) => {
    let clean = newPath.trim();
    if (pane.sessionType !== 'local') {
      if (!clean.startsWith('/')) clean = '/' + clean;
      clean = clean.replace(/\/+/g, '/');
      if (clean.length > 1 && clean.endsWith('/')) {
        clean = clean.slice(0, -1);
      }
    }
    onUpdatePane(pane.id, { currentPath: clean });
  };

  const handleCommitCreateFolder = async (folderName: string) => {
    const isLocalWindows = pane.sessionType === 'local' && (pane.currentPath.includes('\\') || /^[A-Z]:/i.test(pane.currentPath));
    const separator = isLocalWindows ? '\\' : '/';
    const fullPath = `${pane.currentPath.replace(/[/\\]+$/, '')}${separator}${folderName}`;

    if (pane.sessionType === 'local') {
      await api.createLocalFolder(fullPath);
    } else {
      await api.createSftpFolder(fullPath, pane.profile);
    }
    showToast(`Created folder "${folderName}"`, 'success');
    loadFiles();
  };

  const handleDeleteFile = async (file: SFTPFileItem) => {
    try {
      if (pane.sessionType === 'local') {
        await api.deleteLocalFile(file.path, file.type === 'directory');
      } else {
        await api.deleteSftpFile(file.path, file.type === 'directory', pane.profile);
      }
      showToast(`Deleted "${file.name}"`, 'success');
      loadFiles();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleRenameFile = async (file: SFTPFileItem, newName: string) => {
    const isLocalWindows = pane.sessionType === 'local' && (pane.currentPath.includes('\\') || /^[A-Z]:/i.test(pane.currentPath));
    const separator = isLocalWindows ? '\\' : '/';
    const dir = isLocalWindows
      ? file.path.substring(0, file.path.lastIndexOf('\\'))
      : file.path.substring(0, file.path.lastIndexOf('/'));
    const newPath = `${dir}${separator}${newName}`;

    if (pane.sessionType === 'local') {
      await api.renameLocalFile(file.path, newPath);
    } else {
      // sftp rename
      const res = await fetch(`${api.baseUrl}/sftp/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('nodessh_token') ? { Authorization: `Bearer ${localStorage.getItem('nodessh_token')}` } : {}),
        },
        body: JSON.stringify({
          oldPath: file.path,
          newPath,
          ...(pane.profile?.id ? { profileId: pane.profile.id } : {}),
          ...(pane.profile?.host ? { host: pane.profile.host } : {}),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Rename failed');
      }
    }
    loadFiles();
  };

  const handleQuickTransferTo = (targetPaneId: string) => {
    const targetPane = panes.find((p) => p.id === targetPaneId);
    if (!targetPane) return;
    const selectedFiles = files.filter((f) => pane.selectedPaths.includes(f.path));
    if (selectedFiles.length === 0) {
      showToast('Select files to transfer first', 'info');
      return;
    }
    onInitiateTransfer(pane, targetPane, selectedFiles);
  };

  return (
    <div className="h-full w-full flex flex-col min-w-0 border-r border-[var(--theme-border,#1e2640)] last:border-r-0 overflow-hidden bg-[var(--theme-bg-surface,#0e1222)]">
      {/* Header */}
      <FilePaneHeader
        pane={pane}
        panes={panes}
        profiles={profiles}
        terminalTabs={terminalTabs}
        drives={drives}
        quickLocations={quickLocations}
        onUpdatePane={(updates) => onUpdatePane(pane.id, updates)}
        onNavigate={handleNavigate}
        onRefresh={() => loadFiles()}
        onCreateFolder={() => setIsCreatingFolder(true)}
        onClosePane={onClosePane}
        onOpenDirectConnect={onOpenDirectConnect}
        onQuickTransferTo={handleQuickTransferTo}
      />

      {/* Pane Content: Session Chooser or File List */}
      {pane.sessionType === 'unassigned' ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-[var(--theme-bg-surface,#0e1222)]">
          <div className="max-w-md w-full space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-1">
                <FolderTree className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100">Select File Session</h3>
              <p className="text-xs text-slate-400">Choose an existing session or start a new connection for this pane</p>
            </div>

            <div className="space-y-2 pt-2">
              {/* Local Filesystem */}
              <button
                onClick={() => onUpdatePane(pane.id, {
                  sessionType: 'local',
                  title: 'Local Filesystem',
                  currentPath: '',
                })}
                className="w-full p-3 rounded-lg border border-slate-700/60 hover:border-emerald-500/50 bg-slate-900/50 hover:bg-emerald-950/20 text-left transition-all group flex items-center gap-3"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                  <Monitor className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">Local Filesystem</div>
                  <div className="text-[11px] text-slate-400 truncate">Browse local drives, downloads, and files on this PC</div>
                </div>
              </button>

              {/* Active Terminal Tabs */}
              {terminalTabs.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Active SSH Terminal Tabs</div>
                  {terminalTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => onUpdatePane(pane.id, {
                        sessionType: 'terminal',
                        title: `Tab: ${tab.title}`,
                        profileId: tab.profileId,
                        profile: tab.profile,
                        terminalTabId: tab.id,
                        currentPath: tab.cwd || tab.sftpPath || '/',
                      })}
                      className="w-full p-2.5 rounded-lg border border-slate-700/60 hover:border-purple-500/50 bg-slate-900/50 hover:bg-purple-950/20 text-left transition-all group flex items-center gap-3"
                    >
                      <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-200 group-hover:text-purple-300 truncate">{tab.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{tab.profile?.host || 'Local Shell'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Saved Server Profiles */}
              {profiles.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Saved SFTP Server Profiles</div>
                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {profiles.map((prof) => (
                      <button
                        key={prof.id}
                        onClick={() => onUpdatePane(pane.id, {
                          sessionType: 'sftp',
                          title: prof.name,
                          profileId: prof.id,
                          profile: prof,
                          terminalTabId: undefined,
                          currentPath: prof.defaultPath || '/',
                        })}
                        className="w-full p-2.5 rounded-lg border border-slate-700/60 hover:border-cyan-500/50 bg-slate-900/50 hover:bg-cyan-950/20 text-left transition-all group flex items-center gap-3"
                      >
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          <Server className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 truncate">{prof.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{prof.username}@{prof.host}:{prof.port}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connect Standalone SFTP */}
              <button
                onClick={onOpenDirectConnect}
                className="w-full p-3 rounded-lg border border-dashed border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-500/5 hover:bg-cyan-500/10 text-left transition-all group flex items-center gap-3"
              >
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-105 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-cyan-300">+ Connect Standalone SFTP</div>
                  <div className="text-[11px] text-slate-400 truncate">Connect directly to a new remote server without a terminal</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* File List */
        <FilePaneList
          pane={pane}
          panes={panes}
          files={files}
          isLoading={isLoading}
          isCreatingFolder={isCreatingFolder}
          onCancelCreateFolder={() => setIsCreatingFolder(false)}
          onCommitCreateFolder={handleCommitCreateFolder}
          onNavigate={handleNavigate}
          onRefresh={() => loadFiles()}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onInitiateTransfer={onInitiateTransfer}
        />
      )}
    </div>
  );
};
