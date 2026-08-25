import React from 'react';
import {
  Folder,
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
} from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface SftpFileListProps {
  files: SFTPFileItem[];
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}

export const SftpFileList: React.FC<SftpFileListProps> = ({ files, onNavigate, onRefresh }) => {
  const { setEditingFile, setEditingPermissionsFile, showToast } = useApp();
  const [activeMenuFile, setActiveMenuFile] = React.useState<string | null>(null);

  const getFileIcon = (file: SFTPFileItem) => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-500" />;
    }
    if (['sh', 'bash', 'py', 'js', 'ts', 'tsx', 'jsx', 'go', 'rs', 'php', 'rb', 'c', 'cpp'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-emerald-400" />;
    }
    if (['conf', 'cfg', 'ini', 'json', 'yaml', 'yml', 'env', 'toml'].includes(ext)) {
      return <Settings className="w-4 h-4 text-cyan-400" />;
    }
    if (['log', 'txt', 'md', 'out'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-400" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return <Image className="w-4 h-4 text-purple-400" />;
    }
    if (['bin', 'deb', 'rpm', 'iso', 'so', 'exe'].includes(ext) || file.permissions.includes('7')) {
      return <Cpu className="w-4 h-4 text-rose-400" />;
    }

    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = (file: SFTPFileItem) => {
    showToast(`Downloading ${file.name}...`, 'info');
    // Create download trigger
    const blob = new Blob([`# NodeSSH SFTP Download: ${file.name}\n# Path: ${file.path}`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto text-xs select-none">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#0e1222] border-b border-[var(--theme-border,#1e2640)] text-[11px] font-semibold text-slate-400 z-10">
          <tr>
            <th className="py-2 pl-3 pr-2">Name</th>
            <th className="py-2 px-2 hidden sm:table-cell">Size</th>
            <th className="py-2 px-2 hidden md:table-cell">Perms</th>
            <th className="py-2 px-2 hidden lg:table-cell">Modified</th>
            <th className="py-2 pr-3 pl-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {files.map(file => (
            <tr
              key={file.path}
              onDoubleClick={() => {
                if (file.type === 'directory') {
                  onNavigate(file.path);
                } else {
                  setEditingFile(file);
                }
              }}
              className="hover:bg-white/5 group transition-colors cursor-pointer"
            >
              {/* Name */}
              <td className="py-1.5 pl-3 pr-2">
                <div className="flex items-center gap-2">
                  {getFileIcon(file)}
                  <span className="font-mono text-slate-200 group-hover:text-cyan-300 truncate max-w-[180px]">
                    {file.name}
                  </span>
                </div>
              </td>

              {/* Size */}
              <td className="py-1.5 px-2 text-slate-400 font-mono hidden sm:table-cell">
                {file.type === 'directory' ? '-' : formatSize(file.size)}
              </td>

              {/* Perms */}
              <td className="py-1.5 px-2 font-mono text-[11px] text-slate-500 hidden md:table-cell">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setEditingPermissionsFile(file);
                  }}
                  className="hover:text-cyan-400 hover:underline"
                  title="Edit permissions"
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
                  {file.type !== 'directory' && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingFile(file);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10"
                      title="Edit in In-Browser Editor"
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
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setActiveMenuFile(activeMenuFile === file.path ? null : file.path);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
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
                    <div className="absolute right-3 top-8 z-30 w-36 bg-[#151b30] border border-[var(--theme-border,#1e2640)] rounded-lg shadow-xl py-1 text-xs text-left">
                      {file.type !== 'directory' && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingFile(file);
                            setActiveMenuFile(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Edit File</span>
                        </button>
                      )}

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

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDownload(file);
                          setActiveMenuFile(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 text-slate-200"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Download</span>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Delete ${file.name}?`)) {
                            showToast(`Deleted ${file.name}`, 'info');
                            onRefresh();
                          }
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
          ))}
        </tbody>
      </table>
    </div>
  );
};
