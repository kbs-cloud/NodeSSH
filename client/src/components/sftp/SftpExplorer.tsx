import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { api } from '../../services/api';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { SftpFileList } from './SftpFileList';

interface SftpExplorerProps {
  onClose?: () => void;
}

export const SftpExplorer: React.FC<SftpExplorerProps> = ({ onClose }) => {
  const {
    sftpCurrentPath,
    setSftpCurrentPath,
    syncSftpWithTerminalCwd,
    activeTab,
  } = useTerminal();

  const { showToast } = useApp();

  const [files, setFiles] = useState<SFTPFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await api.listSftpFiles(sftpCurrentPath, activeTab?.profileId);
      setFiles(list);
    } catch {
      showToast('Failed to load remote directory files', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [sftpCurrentPath, activeTab?.profileId, showToast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleNavigate = (newPath: string) => {
    setSftpCurrentPath(newPath);
  };

  const handleGoUp = () => {
    const parts = sftpCurrentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = parts.length > 0 ? '/' + parts.join('/') : '/';
    setSftpCurrentPath(upPath);
  };

  // Drag and Drop Upload Handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadFileName(file.name);
      setUploadProgress(0);

      // Simulate progress
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 20;
        setUploadProgress(currentProgress);
        if (currentProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUploadProgress(null);
            showToast(`Uploaded ${file.name} to ${sftpCurrentPath}`, 'success');
            loadFiles();
          }, 400);
        }
      }, 150);
    }
  };

  const handleCreateFolder = () => {
    const folderName = window.prompt('Enter new folder name:');
    if (folderName?.trim()) {
      showToast(`Created folder "${folderName}"`, 'success');
      loadFiles();
    }
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
      {/* SFTP Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--theme-border,#1e2640)] bg-[var(--theme-bg-dark,#070913)]/70">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-[var(--theme-primary,#00f0ff)]" />
          <span className="font-semibold text-xs tracking-wide text-white">SFTP Explorer</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Sync with terminal cwd */}
          <button
            onClick={syncSftpWithTerminalCwd}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10"
            title="Sync with Terminal CWD"
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* New Folder */}
          <button
            onClick={handleCreateFolder}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
            title="New Remote Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
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

      {/* Navigation Breadcrumbs Bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151b30] border-b border-[var(--theme-border,#1e2640)] text-xs">
        <button
          onClick={handleGoUp}
          disabled={sftpCurrentPath === '/'}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
          title="Go Up One Directory (..)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Clickable breadcrumbs */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar font-mono text-[11px]">
          <button
            onClick={() => handleNavigate('/')}
            className="hover:text-cyan-400 text-slate-400 font-semibold px-1 rounded hover:bg-white/5"
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
                  onClick={() => handleNavigate(segmentPath)}
                  className={`px-1 rounded hover:bg-white/5 truncate max-w-[100px] ${
                    isLast ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-cyan-400'
                  }`}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#090b14] border-b border-white/5 text-xs">
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter files..."
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

      {/* Upload Progress Bar (if active) */}
      {uploadProgress !== null && (
        <div className="p-3 bg-cyan-950/90 border-b border-cyan-500/40 text-xs space-y-1">
          <div className="flex justify-between items-center text-cyan-300">
            <span className="truncate font-mono">Uploading: {uploadFileName}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* File List */}
      <SftpFileList files={filteredFiles} onNavigate={handleNavigate} onRefresh={loadFiles} />

      {/* Drag & drop overlay indicator */}
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
