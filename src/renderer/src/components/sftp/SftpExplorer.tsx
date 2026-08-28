import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderTree,
  ArrowUp,
  RefreshCw,
  FolderPlus,
  Upload,
  Eye,
  EyeOff,
  Link,
  Compass,
  Search,
  X,
  Home,
  ArrowRight,
  Edit2,
  Download,
} from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { api } from '../../services/api';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { SftpFileList } from './SftpFileList';
import { TransferProgressBanner } from './TransferProgressBanner';

interface SftpExplorerProps {
  onClose?: () => void;
}

interface TransferState {
  active: boolean;
  name: string;
  progress: number;
  loaded?: number;
  total?: number;
  mode: 'upload' | 'download';
  isFolder?: boolean;
  currentFile?: string;
  exploredFiles?: number;
  exploredDirs?: number;
  processedFiles?: number;
  transferId?: string;
  abortController?: AbortController;
}

export const SftpExplorer: React.FC<SftpExplorerProps> = ({ onClose }) => {
  const {
    sftpCurrentPath,
    setSftpCurrentPath,
    isSftpAutoSync,
    toggleSftpAutoSync,
    syncSftpWithTerminalCwd,
    sendInputToActiveTab,
    activeTab,
  } = useTerminal();

  const { showToast, profiles } = useApp();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Prioritize active tab's profile credentials, then tab's profileId, then manual selection, then first profile
  const activeProfile =
    (selectedProfileId ? profiles.find(p => p.id === selectedProfileId) : null) ||
    activeTab?.profile ||
    (activeTab?.profileId ? profiles.find(p => p.id === activeTab.profileId) : undefined) ||
    (profiles.length > 0 ? profiles[0] : undefined);

  // When active tab changes, sync to active tab's profile
  useEffect(() => {
    if (activeTab?.profile || activeTab?.profileId) {
      setSelectedProfileId(null);
    }
  }, [activeTab?.id]);

  const [files, setFiles] = useState<SFTPFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showHidden, setShowHidden] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isDownloadDragOver, setIsDownloadDragOver] = useState<boolean>(false);
  const [transferState, setTransferState] = useState<TransferState | null>(null);

  // Editable path bar state
  const [pathInput, setPathInput] = useState<string>(sftpCurrentPath);
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize local input whenever current path changes
  useEffect(() => {
    setPathInput(sftpCurrentPath);
  }, [sftpCurrentPath]);

  // Set initial directory based on profile configuration or server default if tab has no path
  useEffect(() => {
    if (sftpCurrentPath) {
      setPathInput(sftpCurrentPath);
    } else if (activeProfile?.defaultPath) {
      setSftpCurrentPath(activeProfile.defaultPath, activeTab?.id);
      setPathInput(activeProfile.defaultPath);
    }
  }, [activeTab?.id, activeProfile?.id, activeProfile?.defaultPath]);

  const loadFiles = useCallback(async (targetPath?: string) => {
    const pathToQuery = targetPath !== undefined ? targetPath : (sftpCurrentPath || activeTab?.sftpPath || '');
    setIsLoading(true);
    try {
      const list = await api.listSftpFiles(pathToQuery, activeProfile);
      setFiles(list);
      if (list.resolvedPath && list.resolvedPath !== sftpCurrentPath) {
        setSftpCurrentPath(list.resolvedPath, activeTab?.id);
        setPathInput(list.resolvedPath);
      }
    } catch (err: any) {
      setFiles([]);
      showToast(err.message || 'Failed to load remote directory files', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [sftpCurrentPath, activeTab?.id, activeTab?.sftpPath, activeProfile, setSftpCurrentPath, showToast]);

  useEffect(() => {
    loadFiles();
  }, [activeProfile?.id, activeProfile?.host, sftpCurrentPath, activeTab?.id]);

  const handleNavigate = (newPath: string) => {
    let clean = newPath.trim();
    if (!clean.startsWith('/')) clean = '/' + clean;
    clean = clean.replace(/\/+/g, '/');
    if (clean.length > 1 && clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    setSftpCurrentPath(clean, activeTab?.id);
    setPathInput(clean);
    setIsEditingPath(false);
  };

  const handleGoUp = () => {
    const parts = sftpCurrentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = parts.length > 0 ? '/' + parts.join('/') : '/';
    handleNavigate(upPath);
  };

  const handleGoHome = () => {
    if (activeProfile?.defaultPath) {
      handleNavigate(activeProfile.defaultPath);
    } else if (activeProfile?.username && activeProfile.username !== 'root') {
      handleNavigate(`/home/${activeProfile.username}`);
    } else if (activeProfile?.username === 'root') {
      handleNavigate('/root');
    } else {
      handleNavigate('/home');
    }
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      handleNavigate(pathInput);
    }
  };

  // Cancel any active transfer
  const handleCancelTransfer = () => {
    if (transferState) {
      if (transferState.abortController) {
        transferState.abortController.abort();
      }
      const electron = (window as any).electronAPI;
      if (transferState.transferId && electron?.cancelDownload) {
        electron.cancelDownload(transferState.transferId);
      }
      if (transferState.transferId) {
        api.abortTransfer(transferState.transferId).catch(() => {});
      } else {
        api.abortTransfer(transferState.name).catch(() => {});
      }
      setTransferState(null);
      showToast('Transfer cancelled', 'info');
    }
  };

  // Listen for native Electron downloads (e.g. from drag-out to desktop or browser downloads)
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (!electron?.onDownloadStarted) return;

    let pollTimer: any = null;

    const unbindStart = electron.onDownloadStarted((data: any) => {
      setTransferState({
        active: true,
        name: data.filename,
        progress: 0,
        loaded: 0,
        total: data.totalBytes || 0,
        mode: 'download',
        isFolder: data.isFolder,
        transferId: data.transferId,
      });

      // Poll status for dynamic folder details if it's a folder download
      if (data.isFolder && data.transferId) {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
          const status = await api.getTransferStatus(data.transferId);
          if (status) {
            setTransferState(prev => {
              if (!prev || prev.transferId !== data.transferId) return prev;
              return {
                ...prev,
                currentFile: status.currentFile,
                exploredFiles: status.exploredFiles,
                exploredDirs: status.exploredDirs,
                processedFiles: status.processedFiles,
                progress: status.percent !== undefined ? status.percent : prev.progress,
                loaded: status.processedBytes || prev.loaded,
                total: status.totalBytes || prev.total,
              };
            });
          }
        }, 250);
      }
    });

    const unbindProgress = electron.onDownloadProgress((data: any) => {
      setTransferState(prev => {
        if (!prev || prev.transferId !== data.transferId) return prev;
        return {
          ...prev,
          progress: data.percent,
          loaded: data.receivedBytes,
          total: data.totalBytes,
        };
      });
    });

    const unbindCompleted = electron.onDownloadCompleted((data: any) => {
      if (pollTimer) clearInterval(pollTimer);
      setTransferState(prev => {
        if (!prev || prev.transferId !== data.transferId) return prev;
        return null;
      });
      const locationInfo = data.savePath ? ` to ${data.savePath}` : '';
      showToast(
        data.wasExtracted
          ? `Extracted folder "${data.filename}"${locationInfo}`
          : `Downloaded "${data.filename}"${locationInfo}`,
        'success'
      );
    });

    const unbindCancelled = electron.onDownloadCancelled((data: any) => {
      if (pollTimer) clearInterval(pollTimer);
      setTransferState(prev => {
        if (!prev || prev.transferId !== data.transferId) return prev;
        return null;
      });
      showToast('Transfer cancelled', 'info');
    });

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      unbindStart?.();
      unbindProgress?.();
      unbindCompleted?.();
      unbindCancelled?.();
    };
  }, [showToast]);

  // Single file uploader with live progress tracking & cancel support
  const uploadSingleFile = async (file: File) => {
    const abortController = new AbortController();

    setTransferState({
      active: true,
      name: file.name,
      progress: 0,
      loaded: 0,
      total: file.size,
      mode: 'upload',
      isFolder: false,
      abortController,
    });

    try {
      await api.uploadSftpFile(
        file,
        sftpCurrentPath,
        activeProfile,
        (percent, loaded, total) => {
          setTransferState(prev => (prev ? { ...prev, progress: percent, loaded, total } : null));
        },
        abortController.signal
      );

      // Explicitly show 100% completion before clearing
      setTransferState(prev => (prev ? { ...prev, progress: 100, loaded: file.size, total: file.size } : null));
      await new Promise(resolve => setTimeout(resolve, 400));
      showToast(`Uploaded "${file.name}" successfully`, 'success');
      loadFiles();
    } catch (err: any) {
      if (abortController.signal.aborted || err.message === 'Upload aborted') {
        showToast('Transfer cancelled', 'info');
      } else {
        showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
      }
    } finally {
      setTransferState(null);
    }
  };

  // Download file or folder with live progress tracking & cancel support
  const handleDownloadFile = async (file: SFTPFileItem) => {
    const isDir = file.type === 'directory';
    const electron = (window as any).electronAPI;
    const transferId = 'dl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    // Native direct file-by-file download in Electron (No ZIP, direct directory on disk)
    if (electron?.downloadDirect && electron?.selectDownloadDirectory) {
      const destDir = await electron.selectDownloadDirectory();
      if (!destDir) return; // User cancelled directory selection

      try {
        await electron.downloadDirect({
          remotePath: file.path,
          localDestDir: destDir,
          isDirectory: isDir,
          transferId,
          profileTarget: activeProfile,
        });
      } catch (err: any) {
        if (err.message !== 'Transfer aborted') {
          showToast(`Download failed: ${err.message}`, 'error');
        }
      }
      return;
    }

    // Web / Browser Blob Fallback
    const downloadName = isDir ? `${file.name}.zip` : file.name;
    const abortController = new AbortController();

    setTransferState({
      active: true,
      name: downloadName,
      progress: 0,
      loaded: 0,
      total: isDir ? 0 : file.size || 0,
      mode: 'download',
      isFolder: isDir,
      transferId,
      abortController,
    });

    try {
      const blob = await api.downloadSftpWithProgress(
        file.path,
        activeProfile,
        isDir,
        (percent, loaded, total, details) => {
          setTransferState(prev => (prev ? {
            ...prev,
            progress: percent,
            loaded,
            total,
            currentFile: details?.currentFile,
            exploredFiles: details?.exploredFiles,
            exploredDirs: details?.exploredDirs,
            processedFiles: details?.processedFiles,
          } : null));
        },
        abortController.signal
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(isDir ? `Downloaded directory "${downloadName}" successfully!` : `Downloaded ${file.name}`, 'success');
    } catch (err: any) {
      if (abortController.signal.aborted || err.message === 'Download aborted') {
        showToast('Transfer cancelled', 'info');
      } else {
        showToast(`Download failed: ${err.message}`, 'error');
      }
    } finally {
      setTransferState(null);
    }
  };

  // Dropdown Drop Download Handler
  const handleDownloadMultiple = async (items: SFTPFileItem[]) => {
    if (items.length === 0) return;
    if (items.length === 1) {
      await handleDownloadFile(items[0]);
      return;
    }

    const electron = (window as any).electronAPI;

    if (electron?.downloadDirect && electron?.selectDownloadDirectory) {
      const destDir = await electron.selectDownloadDirectory();
      if (!destDir) return; // User cancelled directory selection

      for (const item of items) {
        const isDir = item.type === 'directory';
        const transferId = 'dl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        try {
          await electron.downloadDirect({
            remotePath: item.path,
            localDestDir: destDir,
            isDirectory: isDir,
            transferId,
            profileTarget: activeProfile,
          });
        } catch (err: any) {
          if (err.message !== 'Transfer aborted') {
            showToast(`Download failed for ${item.name}: ${err.message}`, 'error');
          }
          if (err.message === 'Transfer aborted') break;
        }
      }
      return;
    }

    // Web / Browser Blob Fallback
    for (const item of items) {
      const isDir = item.type === 'directory';
      const downloadName = isDir ? `${item.name}.zip` : item.name;
      const abortController = new AbortController();
      const transferId = 'dl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

      setTransferState({
        active: true,
        name: downloadName,
        progress: 0,
        loaded: 0,
        total: isDir ? 0 : item.size || 0,
        mode: 'download',
        isFolder: isDir,
        transferId,
        abortController,
      });

      try {
        const blob = await api.downloadSftpWithProgress(
          item.path,
          activeProfile,
          isDir,
          (percent, loaded, total, details) => {
            setTransferState(prev => (prev ? {
              ...prev,
              progress: percent,
              loaded,
              total,
              currentFile: details?.currentFile,
              exploredFiles: details?.exploredFiles,
              exploredDirs: details?.exploredDirs,
              processedFiles: details?.processedFiles,
            } : null));
          },
          abortController.signal
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(isDir ? `Downloaded directory "${downloadName}" successfully!` : `Downloaded ${item.name}`, 'success');
      } catch (err: any) {
        if (abortController.signal.aborted || err.message === 'Download aborted') {
          showToast('Transfer cancelled', 'info');
          break;
        } else {
          showToast(`Download failed for ${item.name}: ${err.message}`, 'error');
        }
      }
    }
    setTransferState(null);
  };

  // Dropdown Drop Download Handler
  const handleDownloadDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDownloadDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (parsed.files && parsed.files.length > 0) {
          await handleDownloadMultiple(parsed.files);
        } else if (parsed.file) {
          await handleDownloadFile(parsed.file);
        }
      }
    } catch (err: any) {
      showToast(`Download drop failed: ${err.message}`, 'error');
    }
  };

  // Drag and Drop Upload Handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesToUpload = Array.from(e.dataTransfer.files);
      for (const file of filesToUpload) {
        await uploadSingleFile(file);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesToUpload = Array.from(e.target.files);
      for (const file of filesToUpload) {
        await uploadSingleFile(file);
      }
      e.target.value = '';
    }
  };

  const handleCreateFolder = () => {
    setIsCreatingFolder(true);
  };

  // Remote Archive Extraction
  const handleExtractRemote = async (file: SFTPFileItem) => {
    try {
      showToast(`Extracting "${file.name}" on server...`, 'info');
      const res = await api.remoteExtract(file.path, sftpCurrentPath, activeProfile);
      showToast(res.message || `Extracted "${file.name}" successfully`, 'success');
      loadFiles();
    } catch (err: any) {
      showToast(`Extraction failed: ${err.message}`, 'error');
    }
  };

  // Remote File/Folder Compression
  const handleCompressRemote = async (file: SFTPFileItem) => {
    try {
      const cleanName = file.name.replace(/[/\\]/g, '');
      const targetArchive = `${sftpCurrentPath === '/' ? '' : sftpCurrentPath}/${cleanName}.tar.gz`;
      showToast(`Compressing "${file.name}" to .tar.gz on server...`, 'info');
      const res = await api.remoteCompress([file.path], targetArchive, activeProfile);
      showToast(res.message || `Compressed to ${cleanName}.tar.gz successfully`, 'success');
      loadFiles();
    } catch (err: any) {
      showToast(`Compression failed: ${err.message}`, 'error');
    }
  };

  // Terminal Integration Handlers
  const handleOpenInTerminal = (path: string) => {
    sendInputToActiveTab(`cd "${path}"\r`);
    showToast(`Navigated terminal to "${path}"`, 'info');
  };

  const handleInsertInTerminal = (path: string) => {
    sendInputToActiveTab(`"${path}" `);
    showToast(`Inserted path into terminal`, 'info');
  };

  // Breadcrumbs parsing
  const pathSegments = sftpCurrentPath.split('/').filter(Boolean);

  const filteredFiles = files.filter(f => {
    if (!showHidden && f.name.startsWith('.') && f.name !== '..') return false;
    if (searchFilter && !f.name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      onDragOver={e => {
        const types = Array.from(e.dataTransfer.types || []);
        // Only trigger upload overlay if dragging actual files from outside the app (not internal file rows)
        if (types.includes('Files') && !types.includes('application/json')) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={e => {
        const types = Array.from(e.dataTransfer.types || []);
        if (types.includes('Files') && !types.includes('application/json')) {
          handleDrop(e);
        } else {
          setIsDragOver(false);
        }
      }}
      className={`h-full w-full flex flex-col bg-[var(--theme-bg-surface,#0e1222)] border-l border-[var(--theme-border,#1e2640)] text-slate-200 relative ${
        isDragOver ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-950/20' : ''
      }`}
    >
      {/* Hidden File Input for Upload Button */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* SFTP Top Header: Title, Profile Selector, and Close Dock */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--theme-border,#1e2640)] bg-[var(--theme-bg-dark,#070913)]/80 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderTree className="w-4 h-4 text-[var(--theme-primary,#00f0ff)] flex-shrink-0" />
          <span className="font-semibold text-xs tracking-wide text-white flex-shrink-0">SFTP</span>
          {activeTab && (
            <span
              className="text-[10px] text-slate-400 font-mono truncate max-w-[80px] hidden xl:inline flex-shrink-0"
              title={`Attached to tab: ${activeTab.title}`}
            >
              [{activeTab.title}]
            </span>
          )}
          {profiles.length > 0 ? (
            <select
              value={activeProfile?.id || ''}
              onChange={e => setSelectedProfileId(e.target.value || null)}
              className="text-[11px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono truncate flex-1 min-w-0 max-w-[150px] outline-none cursor-pointer hover:border-cyan-400"
              title="Target Server Profile for SFTP"
            >
              {activeTab?.profile && !profiles.some(p => p.id === activeTab.profile?.id) && (
                <option value={activeTab.profile.id || ''}>
                  {activeTab.profile.name || activeTab.title}
                </option>
              )}
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : activeProfile ? (
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono truncate max-w-[140px]">
              {activeProfile.name || `${activeProfile.username}@${activeProfile.host}`}
            </span>
          ) : null}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 flex-shrink-0"
            title="Close SFTP Dock"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* SFTP Action Toolbar: Clean, Non-overlapping Action Buttons */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#0b0e1b] border-b border-[var(--theme-border,#1e2640)]/60 text-xs">
        {/* Left Action Group: Create & Upload */}
        <div className="flex items-center gap-1 min-w-0">
          {/* New Folder */}
          <button
            onClick={handleCreateFolder}
            className="px-1.5 py-0.5 rounded text-slate-300 hover:text-amber-400 hover:bg-amber-400/10 flex items-center gap-1 transition-colors flex-shrink-0"
            title="New Remote Folder (Create temporary folder)"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] font-medium hidden xs:inline sm:inline">New Folder</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-1.5 py-0.5 rounded text-slate-300 hover:text-cyan-400 hover:bg-cyan-400/10 flex items-center gap-1 transition-colors flex-shrink-0"
            title="Upload File"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-[11px] font-medium hidden xs:inline sm:inline">Upload</span>
          </button>
        </div>

        {/* Right Action Group: Sync, View & Refresh */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Auto-Sync Toggle */}
          <button
            onClick={() => {
              toggleSftpAutoSync();
              if (!isSftpAutoSync) {
                syncSftpWithTerminalCwd();
                showToast('Auto-sync enabled: SFTP will track Terminal CWD', 'info');
              } else {
                showToast('Auto-sync disabled', 'info');
              }
            }}
            className={`p-1 rounded transition-colors flex-shrink-0 ${
              isSftpAutoSync
                ? 'text-cyan-400 bg-cyan-500/20 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={
              isSftpAutoSync
                ? 'Auto-sync with Terminal CWD: ON (Click to disable)'
                : 'Auto-sync with Terminal CWD: OFF (Click to enable)'
            }
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* Manual Sync with terminal cwd */}
          <button
            onClick={() => {
              syncSftpWithTerminalCwd();
              showToast(`Synced SFTP to terminal directory: ${activeTab?.cwd || '~'}`, 'info');
            }}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10 flex-shrink-0"
            title={`Sync SFTP to Terminal CWD (${activeTab?.cwd || '~'})`}
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Hidden */}
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`p-1 rounded transition-colors flex-shrink-0 ${
              showHidden ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Refresh */}
          <button
            onClick={() => loadFiles()}
            className={`p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0 ${
              isLoading ? 'animate-spin text-cyan-400' : ''
            }`}
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Editable Path & Navigation Bar */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#12172b] border-b border-[var(--theme-border,#1e2640)] text-xs">
        {/* Go Up button */}
        <button
          onClick={handleGoUp}
          disabled={sftpCurrentPath === '/'}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 flex-shrink-0"
          title="Go Up One Directory (..)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Go Home button */}
        <button
          onClick={handleGoHome}
          className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10 flex-shrink-0"
          title="Go to Home Directory"
        >
          <Home className="w-3.5 h-3.5" />
        </button>

        {/* Path Bar: Click to Edit or Direct Type */}
        <div className="flex-1 min-w-0 bg-[#090b14] border border-white/10 rounded px-2 py-0.5 flex items-center gap-1 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/30">
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="flex items-center w-full gap-1">
              <input
                ref={pathInputRef}
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                onBlur={() => {
                  if (pathInput !== sftpCurrentPath) {
                    handleNavigate(pathInput);
                  } else {
                    setIsEditingPath(false);
                  }
                }}
                autoFocus
                className="w-full bg-transparent border-none outline-none font-mono text-[11px] text-cyan-300 placeholder-slate-600"
                placeholder="/path/to/remote/directory"
              />
              <button
                type="submit"
                className="p-0.5 rounded text-cyan-400 hover:bg-cyan-900/40"
                title="Go to path"
              >
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
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleNavigate('/');
                }}
                className="hover:text-cyan-400 text-slate-400 font-semibold px-1 rounded hover:bg-white/10"
              >
                /
              </button>
              {pathSegments.map((segment, idx) => {
                const segmentPath = '/' + pathSegments.slice(0, idx + 1).join('/');
                const isLast = idx === pathSegments.length - 1;
                return (
                  <React.Fragment key={segmentPath}>
                    <span className="text-slate-600">/</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleNavigate(segmentPath);
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
              <Edit2 className="w-2.5 h-2.5 text-slate-600 ml-auto opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#090b14] border-b border-white/5 text-xs">
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter files in current folder..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-600 text-xs w-full font-mono"
        />
        {searchFilter && (
          <button onClick={() => setSearchFilter('')} className="text-slate-500 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Transfer Progress Banner (Upload / Download / Folder Zip) */}
      {transferState && (
        <TransferProgressBanner
          fileName={transferState.name}
          progress={transferState.progress}
          transferredBytes={transferState.loaded}
          totalBytes={transferState.total}
          mode={transferState.mode}
          isFolder={transferState.isFolder}
          currentFile={transferState.currentFile}
          exploredFiles={transferState.exploredFiles}
          exploredDirs={transferState.exploredDirs}
          processedFiles={transferState.processedFiles}
          onCancel={handleCancelTransfer}
        />
      )}

      {/* File List */}
      <SftpFileList
        files={filteredFiles}
        currentPath={sftpCurrentPath}
        profileTarget={activeProfile}
        onNavigate={handleNavigate}
        onRefresh={loadFiles}
        isCreatingFolder={isCreatingFolder}
        onCancelCreateFolder={() => setIsCreatingFolder(false)}
        onDownload={handleDownloadFile}
        onExtractRemote={handleExtractRemote}
        onCompressRemote={handleCompressRemote}
        onOpenInTerminal={handleOpenInTerminal}
        onInsertInTerminal={handleInsertInTerminal}
      />

      {/* Interactive Download Dropzone Bar at Bottom */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDownloadDragOver(true);
        }}
        onDragLeave={() => setIsDownloadDragOver(false)}
        onDrop={handleDownloadDrop}
        className={`px-3 py-2 border-t transition-all flex items-center justify-between text-xs font-mono select-none ${
          isDownloadDragOver
            ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400 ring-inset'
            : 'bg-[#090b14]/90 border-[var(--theme-border,#1e2640)] text-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          <Download className={`w-3.5 h-3.5 ${isDownloadDragOver ? 'text-emerald-400 animate-bounce' : 'text-slate-500'}`} />
          <span className="text-[11px]">
            {isDownloadDragOver ? 'Release to select folder & download directly' : 'Drag file or folder here to Download to Local'}
          </span>
        </div>
        <span className="text-[10px] text-emerald-400/80 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
          Direct stream
        </span>
      </div>

      {/* Drag & drop upload overlay indicator */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-cyan-950/90 border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none">
          <Upload className="w-10 h-10 text-cyan-400 animate-bounce" />
          <span className="text-sm font-semibold text-white">Drop files to upload to SFTP</span>
          <span className="text-xs font-mono text-cyan-300">{sftpCurrentPath}</span>
        </div>
      )}
    </div>
  );
};
