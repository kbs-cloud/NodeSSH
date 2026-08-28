import React, { useState, useEffect, useCallback } from 'react';
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
    loadFiles();
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

      {/* File List */}
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
    </div>
  );
};
