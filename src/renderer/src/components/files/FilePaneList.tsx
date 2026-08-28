import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  FileArchive,
  Image,
  Cpu,
  Settings,
  MoreVertical,
  Download,
  Edit3,
  Trash2,
  Send,
  FolderPlus,
  RefreshCw,
  Copy,
  Check,
  X,
  Shield,
  Upload,
} from 'lucide-react';
import { SFTPFileItem, FilePaneConfig } from '../../types';
import { useApp } from '../../context/AppContext';

interface FilePaneListProps {
  pane: FilePaneConfig;
  panes: FilePaneConfig[];
  files: SFTPFileItem[];
  isLoading: boolean;
  isCreatingFolder: boolean;
  onCancelCreateFolder: () => void;
  onCommitCreateFolder: (folderName: string) => Promise<void>;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
  onDeleteFile: (file: SFTPFileItem) => Promise<void>;
  onRenameFile: (file: SFTPFileItem, newName: string) => Promise<void>;
  onInitiateTransfer: (sourcePane: FilePaneConfig, targetPane: FilePaneConfig, items: SFTPFileItem[], targetSubdir?: string) => void;
}

export const FilePaneList: React.FC<FilePaneListProps> = ({
  pane,
  panes,
  files,
  isLoading,
  isCreatingFolder,
  onCancelCreateFolder,
  onCommitCreateFolder,
  onNavigate,
  onRefresh,
  onDeleteFile,
  onRenameFile,
  onInitiateTransfer,
}) => {
  const { setEditingFile, setEditingPermissionsFile, showToast } = useApp();

  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [activeMenuFile, setActiveMenuFile] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Renaming state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState<string>('');

  // New folder inline state
  const [newFolderName, setNewFolderName] = useState('New Folder');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag over target highlighting
  const [isPaneDragOver, setIsPaneDragOver] = useState(false);

  const otherPanes = panes.filter((p) => p.id !== pane.id);

  // Clear selections on path navigation
  useEffect(() => {
    setSelectedPaths([]);
    setLastSelectedPath(null);
    setRenamingPath(null);
    setActiveMenuFile(null);
  }, [pane.currentPath]);

  // Focus new folder input
  useEffect(() => {
    if (isCreatingFolder) {
      setNewFolderName('New Folder');
      setTimeout(() => {
        newFolderInputRef.current?.focus();
        newFolderInputRef.current?.select();
      }, 50);
    }
  }, [isCreatingFolder]);

  // Focus rename input
  useEffect(() => {
    if (renamingPath) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [renamingPath]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuFile(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateFolderSubmit = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      onCancelCreateFolder();
      return;
    }
    setIsSubmittingFolder(true);
    try {
      await onCommitCreateFolder(trimmed);
      onCancelCreateFolder();
    } catch (err: any) {
      showToast(err.message || 'Failed to create folder', 'error');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleCommitRename = async (file: SFTPFileItem) => {
    const trimmed = renamingValue.trim();
    if (!trimmed || trimmed === file.name) {
      setRenamingPath(null);
      return;
    }
    try {
      await onRenameFile(file, trimmed);
      setRenamingPath(null);
      showToast(`Renamed to "${trimmed}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to rename', 'error');
    }
  };

  const handleFileClick = (file: SFTPFileItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths((prev) =>
        prev.includes(file.path) ? prev.filter((p) => p !== file.path) : [...prev, file.path]
      );
      setLastSelectedPath(file.path);
    } else if (e.shiftKey && lastSelectedPath) {
      const lastIdx = filteredFiles.findIndex((f) => f.path === lastSelectedPath);
      const currIdx = filteredFiles.findIndex((f) => f.path === file.path);
      if (lastIdx >= 0 && currIdx >= 0) {
        const [start, end] = [Math.min(lastIdx, currIdx), Math.max(lastIdx, currIdx)];
        const rangePaths = filteredFiles.slice(start, end + 1).map((f) => f.path);
        setSelectedPaths(Array.from(new Set([...selectedPaths, ...rangePaths])));
      }
    } else {
      setSelectedPaths([file.path]);
      setLastSelectedPath(file.path);
    }
  };

  const handleFileDoubleClick = (file: SFTPFileItem) => {
    if (file.type === 'directory') {
      onNavigate(file.path);
    } else {
      // Open in Code Editor modal
      setEditingFile({
        ...file,
        ...(pane.sessionType === 'local' ? { isLocal: true, owner: 'local' } : { profileTarget: pane.profile }),
      } as any);
    }
  };

  const handleContextMenu = (file: SFTPFileItem, e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedPaths.includes(file.path)) {
      setSelectedPaths([file.path]);
      setLastSelectedPath(file.path);
    }
    setActiveMenuFile(file.path);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  // Drag-out handler
  const handleDragStart = (file: SFTPFileItem, e: React.DragEvent) => {
    const itemsToDrag = selectedPaths.includes(file.path)
      ? files.filter((f) => selectedPaths.includes(f.path))
      : [file];

    const payload = {
      sourcePaneId: pane.id,
      sourceType: pane.sessionType,
      sourcePath: pane.currentPath,
      sourceTarget: pane.profile,
      files: itemsToDrag,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Drag over pane
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPaneDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsPaneDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPaneDragOver(false);

    const jsonStr = e.dataTransfer.getData('application/json');
    if (!jsonStr) return;

    try {
      const data = JSON.parse(jsonStr);
      if (data.sourcePaneId === pane.id) {
        // Dropped inside same pane
        return;
      }

      const sourcePane = panes.find((p) => p.id === data.sourcePaneId) || {
        id: data.sourcePaneId,
        sessionType: data.sourceType,
        title: 'Source Session',
        profile: data.sourceTarget,
        currentPath: data.sourcePath,
      };

      // Always transfer to the current directory of the destination pane
      onInitiateTransfer(sourcePane as FilePaneConfig, pane, data.files, pane.currentPath);
    } catch (err: any) {
      showToast(`Transfer failed: ${err.message}`, 'error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (file: SFTPFileItem) => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 flex-shrink-0" />;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'c', 'cpp', 'html', 'css', 'json', 'sh', 'sql', 'php', 'yaml', 'yml'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-rose-400 flex-shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
      return <Image className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }
    if (['conf', 'cfg', 'ini', 'env', 'config'].includes(ext) || file.name.startsWith('.')) {
      return <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />;
  };

  const filteredFiles = files.filter((f) => {
    if (!pane.showHidden && f.name.startsWith('.') && f.name !== '..') return false;
    if (pane.searchFilter && !f.name.toLowerCase().includes(pane.searchFilter.toLowerCase())) return false;
    return true;
  });

  const selectedFileItems = files.filter((f) => selectedPaths.includes(f.path));

  return (
    <div
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e)}
      className={`flex-1 flex flex-col min-h-0 bg-[var(--theme-bg-dark,#070913)]/40 overflow-hidden relative select-none ${
        isPaneDragOver ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-950/20' : ''
      }`}
    >
      {/* File List Table Header */}
      <div className="grid grid-cols-12 px-3 py-1.5 bg-[#0b0e1b] border-b border-[var(--theme-border,#1e2640)] text-[11px] font-medium text-slate-400">
        <div className="col-span-6 truncate">Name</div>
        <div className="col-span-2 text-right">Size</div>
        <div className="col-span-3 text-right">Modified</div>
        <div className="col-span-1 text-center">Perms</div>
      </div>

      {/* File List Container */}
      <div className="flex-1 overflow-y-auto font-mono text-xs divide-y divide-white/5">
        {/* Inline Create Folder Row */}
        {isCreatingFolder && (
          <div className="grid grid-cols-12 items-center px-3 py-1.5 bg-amber-950/30 border-l-2 border-amber-400">
            <div className="col-span-12 flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <input
                ref={newFolderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolderSubmit();
                  if (e.key === 'Escape') onCancelCreateFolder();
                }}
                disabled={isSubmittingFolder}
                className="bg-black/60 border border-amber-400/50 rounded px-2 py-0.5 text-xs text-amber-200 outline-none flex-1 font-mono"
              />
              <button
                onClick={() => handleCreateFolderSubmit()}
                disabled={isSubmittingFolder}
                className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
                title="Create folder (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onCancelCreateFolder}
                disabled={isSubmittingFolder}
                className="p-1 rounded text-slate-400 hover:bg-white/10"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="text-xs">Loading directory contents...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {pane.searchFilter ? 'No matching files found' : 'Folder is empty'}
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedPaths.includes(file.path);
            const isRenaming = renamingPath === file.path;

            return (
              <div
                key={file.path}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(file, e)}
                onClick={(e) => handleFileClick(file, e)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(file, e)}
                className={`grid grid-cols-12 items-center px-3 py-1.5 cursor-pointer transition-colors group ${
                  isSelected
                    ? 'bg-cyan-950/60 text-cyan-200 border-l-2 border-cyan-400'
                    : 'hover:bg-white/5 text-slate-300 border-l-2 border-transparent'
                }`}
              >
                {/* Name */}
                <div className="col-span-6 flex items-center gap-2 min-w-0 pr-2">
                  {getFileIcon(file)}
                  {isRenaming ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename(file);
                          if (e.key === 'Escape') setRenamingPath(null);
                        }}
                        onBlur={() => handleCommitRename(file)}
                        className="bg-black/80 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none flex-1 font-mono"
                      />
                    </div>
                  ) : (
                    <span className="truncate font-sans font-normal text-xs text-slate-200 group-hover:text-white" title={file.name}>
                      {file.name}
                    </span>
                  )}
                </div>

                {/* Size */}
                <div className="col-span-2 text-right text-[11px] text-slate-400 truncate">
                  {file.type === 'directory' ? '-' : formatFileSize(file.size)}
                </div>

                {/* Modified Date */}
                <div className="col-span-3 text-right text-[11px] text-slate-500 truncate">
                  {formatDate(file.modifyTime)}
                </div>

                {/* Permissions */}
                <div className="col-span-1 text-center text-[10px] text-slate-500 font-mono">
                  {file.permissions ? file.permissions.slice(-3) : '-'}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Drag & Drop Dropzone Overlay */}
      {isPaneDragOver && (
        <div className="absolute inset-0 z-30 bg-cyan-950/80 border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-2 backdrop-blur-xs pointer-events-none">
          <Upload className="w-8 h-8 text-cyan-400 animate-bounce" />
          <span className="text-sm font-semibold text-white">Drop to transfer to {pane.title}</span>
          <span className="text-xs font-mono text-cyan-300 truncate max-w-[80%]">{pane.currentPath}</span>
        </div>
      )}

      {/* Context Menu Modal / Floating Menu */}
      {activeMenuFile && menuPosition && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: Math.min(menuPosition.y, window.innerHeight - 300),
            left: Math.min(menuPosition.x, window.innerWidth - 220),
          }}
          className="w-56 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-2xl py-1 z-50 text-xs select-none"
        >
          {/* Transfer to other panes */}
          {otherPanes.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Transfer to Split Pane
              </div>
              {otherPanes.map((targetP) => (
                <button
                  key={targetP.id}
                  onClick={() => {
                    setActiveMenuFile(null);
                    onInitiateTransfer(pane, targetP, selectedFileItems.length > 0 ? selectedFileItems : files.filter((f) => f.path === activeMenuFile));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-cyan-500/20 text-cyan-300"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="truncate">Send to {targetP.title}</span>
                </button>
              ))}
              <div className="my-1 border-t border-white/5" />
            </>
          )}

          {/* Edit in Code Editor */}
          <button
            onClick={() => {
              const target = files.find((f) => f.path === activeMenuFile);
              if (target) {
                setEditingFile({
                  ...target,
                  ...(pane.sessionType === 'local' ? { isLocal: true, owner: 'local' } : { profileTarget: pane.profile }),
                } as any);
              }
              setActiveMenuFile(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 text-slate-200"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open in Code Editor</span>
          </button>

          {/* Rename */}
          <button
            onClick={() => {
              const target = files.find((f) => f.path === activeMenuFile);
              if (target) {
                setRenamingPath(target.path);
                setRenamingValue(target.name);
              }
              setActiveMenuFile(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 text-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Rename</span>
          </button>

          {/* Permissions (chmod) */}
          {pane.sessionType !== 'local' && (
            <button
              onClick={() => {
                const target = files.find((f) => f.path === activeMenuFile);
                if (target) setEditingPermissionsFile(target);
                setActiveMenuFile(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/10 text-slate-200"
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>Change Permissions</span>
            </button>
          )}

          <div className="my-1 border-t border-white/5" />

          {/* Delete */}
          <button
            onClick={async () => {
              const itemsToDelete = selectedFileItems.length > 0
                ? selectedFileItems
                : files.filter((f) => f.path === activeMenuFile);
              setActiveMenuFile(null);
              if (window.confirm(`Delete ${itemsToDelete.length} item(s)?`)) {
                for (const item of itemsToDelete) {
                  await onDeleteFile(item);
                }
              }
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-500/20 text-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
};
