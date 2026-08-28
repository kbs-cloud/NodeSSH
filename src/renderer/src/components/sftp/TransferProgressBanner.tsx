import React from 'react';
import { Upload, Download, Archive, X, Loader2 } from 'lucide-react';

export interface TransferProgressBannerProps {
  fileName: string;
  progress: number; // 0 - 100
  transferredBytes?: number;
  totalBytes?: number;
  mode: 'upload' | 'download';
  isFolder?: boolean;
  currentFile?: string;
  exploredFiles?: number;
  exploredDirs?: number;
  processedFiles?: number;
  onCancel: () => void;
}

export const TransferProgressBanner: React.FC<TransferProgressBannerProps> = ({
  fileName,
  progress,
  transferredBytes,
  totalBytes,
  mode,
  isFolder,
  currentFile,
  exploredFiles,
  exploredDirs,
  processedFiles,
  onCancel,
}) => {
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const roundedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  const getByteText = (): string => {
    if (isFolder && mode === 'download') {
      const fileCountText = exploredFiles ? ` (${processedFiles || 0}/${exploredFiles} files)` : '';
      if (totalBytes && totalBytes > 0 && transferredBytes !== undefined) {
        return `${formatBytes(transferredBytes)} / ${formatBytes(totalBytes)}${fileCountText}`;
      }
      if (transferredBytes && transferredBytes > 0) {
        return `${formatBytes(transferredBytes)} streamed${fileCountText}`;
      }
      if (exploredFiles) {
        return `${processedFiles || 0}/${exploredFiles} files explored`;
      }
      return 'Exploring and streaming files...';
    }

    if (totalBytes && totalBytes > 0 && transferredBytes !== undefined) {
      return `${formatBytes(transferredBytes)} / ${formatBytes(totalBytes)}`;
    }

    if (transferredBytes && transferredBytes > 0) {
      return `${formatBytes(transferredBytes)} transferred`;
    }

    return `${roundedProgress}%`;
  };

  const getTitle = (): string => {
    if (isFolder) {
      return mode === 'upload' ? `Uploading Folder: ${fileName}` : `Downloading Folder: ${fileName}`;
    }
    return mode === 'upload' ? `Uploading: ${fileName}` : `Downloading: ${fileName}`;
  };

  return (
    <div className="p-2.5 bg-[#090d1e]/95 border-b border-cyan-500/40 text-xs shadow-lg backdrop-blur-md relative overflow-hidden transition-all">
      {/* Top row: Icon, Name, Percentage, Cancel Button */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isFolder ? (
            <Archive className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-pulse" />
          ) : mode === 'upload' ? (
            <Upload className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 animate-bounce" />
          ) : (
            <Download className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 animate-bounce" />
          )}
          <span className="truncate font-mono text-[11px] text-cyan-200 font-medium" title={fileName}>
            {getTitle()}
          </span>
          {currentFile && (
            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[180px] hidden sm:inline" title={currentFile}>
              ({currentFile})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-[11px] font-bold text-cyan-300">
            {roundedProgress}%
          </span>
          <button
            onClick={onCancel}
            className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center gap-1 transition-all text-[10px] font-semibold cursor-pointer active:scale-95"
            title="Cancel Transfer"
          >
            <X className="w-3 h-3" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* Progress Bar with Cyan / Emerald Neon Gradient */}
      <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 relative">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-200 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
          style={{ width: `${roundedProgress}%` }}
        />
      </div>

      {/* Subtext info row: Formatted Bytes / Streaming status */}
      <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-mono">
        <span>{getByteText()}</span>
        <span className="flex items-center gap-1 text-slate-500">
          <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
          {mode === 'upload'
            ? 'Sending chunks'
            : isFolder
            ? (currentFile ? `Copying ${currentFile}` : 'Streaming files')
            : 'Receiving chunks'}
        </span>
      </div>
    </div>
  );
};
