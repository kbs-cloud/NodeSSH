import React, { useState } from 'react';
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
} from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface SftpFileListProps {
  files: SFTPFileItem[];
  currentPath: string;
  profileId?: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}

export const SftpFileList: React.FC<SftpFileListProps> = ({
  files,
  currentPath,
  profileId,
  onNavigate,
  onRefresh,
}) => {
  const { setEditingFile, setEditingPermissionsFile, showToast } = useApp();
  const [activeMenuFile, setActiveMenuFile] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

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
    const isDir = file.type === 'directory';
    const downloadName = isDir ? `${file.name}.zip` : file.name;
    showToast(isDir ? `Compressing & downloading "${file.name}" as .zip...` : `Downloading ${file.name}...`, 'info');

    try {
      const q = new URLSearchParams({ path: file.path });
      if (profileId) q.set('profileId', profileId);

      const token = localStorage.getItem('nodessh_token') || '';
      const res = await fetch(`/api/sftp/download?${q.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Download request failed');

      const blob = await res.blob();
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
        await api.deleteSftpFile(file.path, file.type === 'directory', profileId);
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
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = parts.length > 0 ? '/' + parts.join('/') : '/';
    onNavigate(upPath);
  };

  return (
    <div className="flex-1 overflow-y-auto text-xs select-none">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#0e1222] border-b border-[var(--theme-border,#1e2640)] text-[11px] font-semibold text-slate-400 z-10">
          <tr>
            <th className="py-2 pl-3 pr-2">Name</th>
            <th className="py-2 px-2 hidden sm:table-cell w-20">Size</th>
            <th className="py-2 px-2 hidden md:table-cell w-24">Perms</th>
            <th className="py-2 px-2 hidden lg:table-cell w-32">Modified</th>
            <th className="py-2 pr-3 pl-2 text-right w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {/* Top Parent Directory Row ("..") */}
          {currentPath !== '/' && (
            <tr
              onClick={handleGoUp}
              className="hover:bg-cyan-500/10 transition-colors cursor-pointer text-slate-400 hover:text-cyan-300"
            >
              <td className="py-1.5 pl-3 pr-2" colSpan={5}>
                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold">
                  <CornerLeftUp className="w-4 h-4 text-cyan-400" />
                  <span>.. (Up to parent directory)</span>
                </div>
              </td>
            </tr>
          )}

          {files.map(file => {
            const isSelected = selectedFilePath === file.path;
            const isDir = file.type === 'directory';

            return (
              <tr
                key={file.path}
                draggable={true}
                onDragStart={(e) => {
                  const mimeType = isDir ? 'application/zip' : 'application/octet-stream';
                  const downloadName = isDir ? `${file.name}.zip` : file.name;
                  const q = new URLSearchParams({ path: file.path });
                  if (profileId) q.set('profileId', profileId);
                  const downloadUrl = `${window.location.origin}/api/sftp/download?${q.toString()}`;

                  // Standard Chromium desktop drag-to-download format
                  e.dataTransfer.setData('DownloadURL', `${mimeType}:${downloadName}:${downloadUrl}`);
                  e.dataTransfer.setData('application/json', JSON.stringify({ file, profileId }));
                  e.dataTransfer.setData('text/plain', file.path);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => setSelectedFilePath(file.path)}
                onDoubleClick={() => {
                  if (isDir) {
                    onNavigate(file.path);
                  } else {
                    setEditingFile(file);
                  }
                }}
                className={`group transition-colors cursor-grab active:cursor-grabbing ${
                  isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-white/5'
                }`}
                title={isDir ? `Drag to desktop/dropzone to download "${file.name}" as .zip archive` : `Drag to download "${file.name}"`}
              >
                {/* Name & Icon */}
                <td className="py-1.5 pl-3 pr-2">
                  <div
                    onClick={(e) => {
                      if (isDir) {
                        e.stopPropagation();
                        onNavigate(file.path);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-60 flex-shrink-0" />
                    {getFileIcon(file)}
                    <span
                      className={`font-mono truncate max-w-[200px] ${
                        isDir
                          ? 'text-cyan-300 font-medium hover:underline hover:text-cyan-200'
                          : 'text-slate-200 group-hover:text-white'
                      }`}
                      title={file.name}
                    >
                      {file.name}
                    </span>
                  </div>
                </td>

                {/* Size */}
                <td className="py-1.5 px-2 text-slate-400 font-mono text-[11px] hidden sm:table-cell">
                  {isDir ? '-' : formatSize(file.size)}
                </td>

                {/* Perms */}
                <td className="py-1.5 px-2 font-mono text-[11px] text-slate-500 hidden md:table-cell">
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
                </td>

                {/* Date */}
                <td className="py-1.5 px-2 text-slate-500 text-[11px] hidden lg:table-cell">
                  {new Date(file.modifyTime).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>

                {/* Actions */}
                <td className="py-1.5 pr-3 pl-2 text-right relative">
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
                      title={isDir ? 'Download entire folder as .zip archive' : 'Download file'}
                    >
                      {isDir ? <Archive className="w-3.5 h-3.5 text-amber-400" /> : <Download className="w-3.5 h-3.5" />}
                    </button>

                    <button
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
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={e => {
                          e.stopPropagation();
                          setActiveMenuFile(null);
                        }}
                      />
                      <div className="absolute right-3 top-8 z-30 w-44 bg-[#151b30] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-xl py-1 text-xs text-left">
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
                              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-amber-300"
                            >
                              <Archive className="w-3.5 h-3.5 text-amber-400" />
                              <span>Download as .ZIP</span>
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
                    </>
                  )}
                </td>
              </tr>
            );
          })}

          {files.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                Empty directory
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
