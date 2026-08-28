import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileArchive,
  Cpu,
  Image,
  Settings,
  MoreVertical,
  Download,
  Edit3,
  Shield,
  Trash2,
  CornerLeftUp,
  Copy,
  Archive,
  GripVertical,
  Terminal,
  ChevronRight,
  Package,
} from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { api, getApiBase, ProfileTarget } from '../../services/api';
import { storage } from '../../services/storage';

interface SftpFileListProps {
  files: SFTPFileItem[];
  currentPath: string;
  profileTarget?: ProfileTarget;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onDownload?: (file: SFTPFileItem) => void;
  onExtractRemote?: (file: SFTPFileItem) => void;
  onCompressRemote?: (file: SFTPFileItem) => void;
  onOpenInTerminal?: (path: string) => void;
  onInsertInTerminal?: (path: string) => void;
}

export const SftpFileList: React.FC<SftpFileListProps> = ({
  files,
  currentPath,
  profileTarget,
  onNavigate,
  onRefresh,
  onDownload,
  onExtractRemote,
  onCompressRemote,
  onOpenInTerminal,
  onInsertInTerminal,
}) => {
  const { setEditingFile, setEditingPermissionsFile, showToast } = useApp();
  const [activeMenuFile, setActiveMenuFile] = useState<string | null>(null);
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedFilePaths([]);
    setLastSelectedPath(null);
  }, [currentPath]);

  useEffect(() => {
    if (!activeMenuFile) return;

    const rafId = requestAnimationFrame(() => {
      if (menuRef.current) {
        menuRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      if ((e.target as HTMLElement)?.closest?.('[data-menu-trigger]')) {
        return;
      }
      setActiveMenuFile(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuFile(null);
        setSelectedFilePaths([]);
        setLastSelectedPath(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuFile]);

  const isArchiveFile = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    return (
      lower.endsWith('.tar.gz') ||
      lower.endsWith('.tgz') ||
      lower.endsWith('.zip') ||
      lower.endsWith('.tar') ||
      lower.endsWith('.bz2') ||
      lower.endsWith('.tbz2') ||
      lower.endsWith('.xz') ||
      lower.endsWith('.txz') ||
      lower.endsWith('.7z')
    );
  };

  const getFileIcon = (file: SFTPFileItem) => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 flex-shrink-0" />;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    }
    if (['sh', 'bash', 'py', 'js', 'ts', 'tsx', 'jsx', 'go', 'rs', 'php', 'rb', 'c', 'cpp'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }
    if (['conf', 'cfg', 'ini', 'json', 'yaml', 'yml', 'env', 'toml'].includes(ext)) {
      return <Settings className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
    }
    if (['log', 'txt', 'md', 'out'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return <Image className="w-4 h-4 text-purple-400 flex-shrink-0" />;
    }
    if (['bin', 'deb', 'rpm', 'iso', 'so', 'exe'].includes(ext) || file.permissions.includes('7')) {
      return <Cpu className="w-4 h-4 text-rose-400 flex-shrink-0" />;
    }

    return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async (file: SFTPFileItem) => {
    if (onDownload) {
      onDownload(file);
      return;
    }

    const isDir = file.type === 'directory';
    const downloadName = isDir ? `${file.name}.zip` : file.name;
    showToast(isDir ? `Compressing & downloading "${file.name}" as .zip...` : `Downloading ${file.name}...`, 'info');

    try {
      const blob = await api.downloadSftpWithProgress(file.path, profileTarget, isDir);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(isDir ? `Downloaded directory "${downloadName}" successfully!` : `Downloaded ${file.name}`, 'success');
    } catch {
      showToast(`Failed to download ${file.name}`, 'error');
    }
  };

  const handleDelete = async (file: SFTPFileItem) => {
    if (window.confirm(`Are you sure you want to permanently delete "${file.name}"?`)) {
      try {
        await api.deleteSftpFile(file.path, file.type === 'directory', profileTarget);
        showToast(`Deleted ${file.name}`, 'info');
        onRefresh();
      } catch (err: any) {
        showToast(`Failed to delete: ${err.message}`, 'error');
      }
    }
  };

  const handleCopyPath = (file: SFTPFileItem) => {
    navigator.clipboard.writeText(file.path);
    showToast(`Copied path: ${file.path}`, 'info');
  };

  const handleGoUp = () => {
    setSelectedFilePaths([]);
    setLastSelectedPath(null);
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = parts.length > 0 ? '/' + parts.join('/') : '/';
    onNavigate(upPath);
  };

  const handleRowClick = (e: React.MouseEvent, file: SFTPFileItem) => {
    e.stopPropagation();
    const isMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isMeta) {
      setSelectedFilePaths(prev => {
        const index = prev.indexOf(file.path);
        if (index >= 0) {
          return prev.filter(p => p !== file.path);
        } else {
          return [...prev, file.path];
        }
      });
      setLastSelectedPath(file.path);
    } else if (isShift && lastSelectedPath) {
      const lastIndex = files.findIndex(f => f.path === lastSelectedPath);
      const currentIndex = files.findIndex(f => f.path === file.path);
      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangePaths = files.slice(start, end + 1).map(f => f.path);
        setSelectedFilePaths(prev => {
          return Array.from(new Set([...prev, ...rangePaths]));
        });
      }
    } else {
      setSelectedFilePaths([file.path]);
      setLastSelectedPath(file.path);
    }
  };

  const handleItemDragStart = (e: React.DragEvent, file: SFTPFileItem) => {
    e.stopPropagation();
    
    let dragFiles: SFTPFileItem[] = [];
    if (selectedFilePaths.includes(file.path)) {
      dragFiles = files.filter(f => selectedFilePaths.includes(f.path));
    } else {
      setSelectedFilePaths([file.path]);
      setLastSelectedPath(file.path);
      dragFiles = [file];
    }

    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        file: dragFiles[0],
        files: dragFiles,
        profileTarget,
      })
    );

    const pathsString = dragFiles.map(f => `"${f.path}"`).join(' ');
    e.dataTransfer.setData('text/plain', pathsString);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="flex-1 overflow-auto text-xs select-none"
      onClick={() => {
        setSelectedFilePaths([]);
        setLastSelectedPath(null);
      }}
    >
      {/*
        This uses a plain flex/div layout rather than a real <table>/<tr>
        on purpose: Chromium does not reliably fire 'dragstart' on
        HTMLTableRowElement (<tr>, even with CSS display overridden), which
        made every file row here permanently undraggable no matter what the
        drag handler itself did. Divs styled to look like a table sidestep
        that entirely. Verified directly against this app's own Electron/
        Chromium build before making this change.
      */}
      <div className="w-full text-left" role="table">
        <div
          role="row"
          className="flex sticky top-0 bg-[#0e1222] border-b border-[var(--theme-border,#1e2640)] text-[11px] font-semibold text-slate-400 z-10"
        >
          <div role="columnheader" className="flex-1 py-2 pl-3 pr-2">Name</div>
          <div role="columnheader" className="hidden sm:block py-2 px-2 w-20 flex-shrink-0">Size</div>
          <div role="columnheader" className="hidden md:block py-2 px-2 w-24 flex-shrink-0">Perms</div>
          <div role="columnheader" className="hidden lg:block py-2 px-2 w-32 flex-shrink-0">Modified</div>
          <div role="columnheader" className="py-2 pr-3 pl-2 text-right w-24 flex-shrink-0">Actions</div>
        </div>

        <div role="rowgroup" className="divide-y divide-white/5">
          {/* Top Parent Directory Row ("..") */}
          {currentPath !== '/' && (
            <div
              role="row"
              onClick={handleGoUp}
              className="flex items-center hover:bg-cyan-500/10 transition-colors cursor-pointer text-slate-400 hover:text-cyan-300"
            >
              <div role="cell" className="py-1.5 pl-3 pr-2 flex items-center gap-2 font-mono text-[11px] font-semibold">
                <CornerLeftUp className="w-4 h-4 text-cyan-400" />
                <span>.. (Up to parent directory)</span>
              </div>
            </div>
          )}

          {files.map(file => {
            const isSelected = selectedFilePaths.includes(file.path);
            const isDir = file.type === 'directory';
            const isArchive = !isDir && isArchiveFile(file.name);

            return (
              <div
                role="row"
                key={file.path}
                draggable={true}
                onDragStart={e => handleItemDragStart(e, file)}
                onClick={e => handleRowClick(e, file)}
                onDoubleClick={() => {
                  if (isDir) {
                    onNavigate(file.path);
                  } else {
                    setEditingFile(file);
                  }
                }}
                style={{ WebkitUserDrag: 'element', userSelect: 'none' } as React.CSSProperties}
                className={`group flex items-center transition-colors cursor-grab active:cursor-grabbing select-none ${
                  isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-white/5'
                }`}
                title={
                  isDir
                    ? `Drag folder "${file.name}" to Desktop / Explorer or bottom bar`
                    : `Drag file "${file.name}" to Desktop / Explorer or bottom bar`
                }
              >
                {/* Name & Icon */}
                {/*
                  min-w-[140px] (not min-w-0): this column competes for space
                  with several fixed-width sibling columns below, and the
                  docked SFTP panel can be much narrower than all of them
                  combined (e.g. 320px vs 400px of fixed columns) - min-w-0
                  let this shrink all the way to 0px there, making the name
                  invisible. 140px leaves ~75px of actual text after the
                  grip/file icons, gaps, and padding - enough for a readable
                  truncated name. When the panel is too narrow for every
                  column at once, the row now overflows and scrolls (see the
                  overflow-x-auto on the scroll container below) instead of
                  silently hiding content.
                */}
                <div role="cell" className="flex-1 min-w-[140px] py-1.5 pl-3 pr-2 select-none">
                  <div className="flex items-center gap-2 select-none">
                    <GripVertical className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                    {getFileIcon(file)}
                    <span
                      className={`font-mono truncate max-w-[200px] ${
                        isDir
                          ? 'text-cyan-300 font-medium hover:text-cyan-200'
                          : 'text-slate-200 group-hover:text-white'
                      }`}
                      title={file.name}
                    >
                      {file.name}
                    </span>
                  </div>
                </div>

                {/* Size */}
                <div role="cell" className="hidden sm:block py-1.5 px-2 w-20 flex-shrink-0 text-slate-400 font-mono text-[11px]">
                  {isDir ? '-' : formatSize(file.size)}
                </div>

                {/* Perms */}
                <div role="cell" className="hidden md:block py-1.5 px-2 w-24 flex-shrink-0 font-mono text-[11px] text-slate-500">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setEditingPermissionsFile(file);
                    }}
                    className="hover:text-cyan-400 hover:underline"
                    title="Click to edit chmod permissions"
                  >
                    {file.permissions}
                  </button>
                </div>

                {/* Date */}
                <div role="cell" className="hidden lg:block py-1.5 px-2 w-32 flex-shrink-0 text-slate-500 text-[11px]">
                  {new Date(file.modifyTime).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>

                {/* Actions */}
                <div role="cell" className="py-1.5 pr-3 pl-2 w-24 flex-shrink-0 text-right relative">
                  <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                    {!isDir && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingFile(file);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10"
                        title="Edit in Code Editor"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDownload(file);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-white/10"
                      title={isDir ? 'Download folder' : 'Download file'}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    <button
                      data-menu-trigger="true"
                      onClick={e => {
                        e.stopPropagation();
                        setActiveMenuFile(activeMenuFile === file.path ? null : file.path);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                      title="More Options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {activeMenuFile === file.path && (
                    <div
                      ref={menuRef}
                      className="absolute right-3 top-8 z-30 w-52 bg-[#151b30] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-2xl py-1 text-xs text-left"
                    >
                      {isDir ? (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onNavigate(file.path);
                              setActiveMenuFile(null);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-cyan-300"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Open Folder</span>
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleDownload(file);
                              setActiveMenuFile(null);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-emerald-300"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Download Folder</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingFile(file);
                              setActiveMenuFile(null);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Edit in Editor</span>
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleDownload(file);
                              setActiveMenuFile(null);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Download File</span>
                          </button>
                        </>
                      )}

                      <div className="my-1 border-t border-white/10" />

                      {/* Terminal Deep Integrations */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (onOpenInTerminal) {
                            onOpenInTerminal(file.path);
                          }
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-cyan-300"
                        title="Navigate active terminal to this location"
                      >
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Open in Terminal (<code className="text-[10px] text-cyan-200">cd</code>)</span>
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (onInsertInTerminal) {
                            onInsertInTerminal(file.path);
                          }
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                        title="Paste path into active terminal"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>Insert Path in Terminal</span>
                      </button>

                      {/* Remote Compression & Extraction Actions */}
                      {isArchive && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (onExtractRemote) {
                              onExtractRemote(file);
                            }
                            setActiveMenuFile(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-amber-300"
                          title="Extract archive on remote server"
                        >
                          <Package className="w-3.5 h-3.5 text-amber-400" />
                          <span>Extract on Remote Server</span>
                        </button>
                      )}

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (onCompressRemote) {
                            onCompressRemote(file);
                          }
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                        title="Compress into .tar.gz archive on remote server"
                      >
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                        <span>Compress to .tar.gz on Server</span>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleCopyPath(file);
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Path</span>
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingPermissionsFile(file);
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                      >
                        <Shield className="w-3.5 h-3.5 text-purple-400" />
                        <span>Permissions</span>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(file);
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-rose-500/20 text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {files.length === 0 && (
            <div role="row">
              <div role="cell" className="py-8 text-center text-slate-500 italic">
                Empty directory
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
