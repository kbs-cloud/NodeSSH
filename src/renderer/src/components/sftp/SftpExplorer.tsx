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
  abortController?: AbortController;
}

export const SftpExplorer: React.FC<SftpExplorerProps> = ({ onClose }) => {
  const {
    sftpCurrentPath,
    setSftpCurrentPath,
    syncSftpWithTerminalCwd,
    sendInputToActiveTab,
    activeTab,
  } = useTerminal();

  const { showToast, profiles } = useApp();

  const profileId = activeTab?.profileId || activeTab?.profile?.id || (profiles.length > 0 ? profiles[0].id : undefined);
  const activeProfile = profiles.find(p => p.id === profileId) || activeTab?.profile;

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
  const pathInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize local input whenever current path changes
  useEffect(() => {
    setPathInput(sftpCurrentPath);
  }, [sftpCurrentPath]);

  // Set initial home directory based on profile configuration
  useEffect(() => {
    if (activeProfile?.defaultPath) {
      setSftpCurrentPath(activeProfile.defaultPath);
      setPathInput(activeProfile.defaultPath);
    } else if (activeProfile?.username) {
      const userHome = activeProfile.username === 'root' ? '/root' : `/home/${activeProfile.username}`;
      if (!sftpCurrentPath || sftpCurrentPath === '/' || sftpCurrentPath.includes('ubuntu')) {
        setSftpCurrentPath(userHome);
        setPathInput(userHome);
      }
    } else if (!sftpCurrentPath) {
      setSftpCurrentPath('/');
      setPathInput('/');
    }
  }, [activeProfile?.id, activeProfile?.username, activeProfile?.defaultPath]);

  const loadFiles = useCallback(async () => {
    if (!sftpCurrentPath) return;
    setIsLoading(true);
    try {
      const list = await api.listSftpFiles(sftpCurrentPath, profileId);
      setFiles(list);
    } catch (err: any) {
      setFiles([]);
      showToast(err.message || 'Failed to load remote directory files', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [sftpCurrentPath, profileId, showToast]);

  useEffect(() => {
    if (sftpCurrentPath) {
      loadFiles();
    }
  }, [loadFiles, sftpCurrentPath]);

  const handleNavigate = (newPath: string) => {
    let clean = newPath.trim();
    if (!clean.startsWith('/')) clean = '/' + clean;
    clean = clean.replace(/\/+/g, '/');
    if (clean.length > 1 && clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    setSftpCurrentPath(clean);
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
      api.abortTransfer(transferState.name).catch(() => {});
      setTransferState(null);
      showToast('Transfer cancelled', 'info');
    }
  };

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
        profileId,
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
      abortController,
    });

    try {
      const blob = await api.downloadSftpWithProgress(
        file.path,
        profileId,
        isDir,
        (percent, loaded, total) => {
          setTransferState(prev => (prev ? { ...prev, progress: percent, loaded, total } : null));
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
  const handleDownloadDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDownloadDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const { file } = JSON.parse(dataStr);
        if (file) {
          await handleDownloadFile(file);
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

  const handleCreateFolder = async () => {
    const folderName = window.prompt('Enter new folder name:');
    if (folderName?.trim()) {
      const fullPath = `${sftpCurrentPath === '/' ? '' : sftpCurrentPath}/${folderName.trim()}`;
      await api.createSftpFolder(fullPath, profileId);
      showToast(`Created folder "${folderName}"`, 'success');
      loadFiles();
    }
  };

  // Remote Archive Extraction
  const handleExtractRemote = async (file: SFTPFileItem) => {
    try {
      showToast(`Extracting "${file.name}" on server...`, 'info');
      const res = await api.remoteExtract(file.path, sftpCurrentPath, profileId);
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
      const res = await api.remoteCompress([file.path], targetArchive, profileId);
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
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
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

      {/* SFTP Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--theme-border,#1e2640)] bg-[var(--theme-bg-dark,#070913)]/70">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-[var(--theme-primary,#00f0ff)]" />
          <span className="font-semibold text-xs tracking-wide text-white">SFTP Explorer</span>
          {activeProfile && (
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
              {activeProfile.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10"
            title="Upload File"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {/* New Folder */}
          <button
            onClick={handleCreateFolder}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
            title="New Remote Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {/* Sync with terminal cwd */}
          <button
            onClick={syncSftpWithTerminalCwd}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10"
            title="Sync with Terminal CWD"
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Hidden */}
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`p-1 rounded transition-colors ${
              showHidden ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadFiles}
            className={`p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 ${
              isLoading ? 'animate-spin text-cyan-400' : ''
            }`}
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 ml-1"
              title="Close SFTP Dock"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
          onCancel={handleCancelTransfer}
        />
      )}

      {/* File List */}
      <SftpFileList
        files={filteredFiles}
        currentPath={sftpCurrentPath}
        profileId={profileId}
        onNavigate={handleNavigate}
        onRefresh={loadFiles}
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
            {isDownloadDragOver ? 'Release to download item / folder as .ZIP' : 'Drag file or folder here to Download'}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
          Folders auto-zip
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
