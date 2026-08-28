import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { CrossTransferTask } from '../../types';

interface TransferQueueDrawerProps {
  tasks: CrossTransferTask[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onCancelTask: (taskId: string) => void;
  onClearCompleted: () => void;
}

export const TransferQueueDrawer: React.FC<TransferQueueDrawerProps> = ({
  tasks,
  isOpen,
  onToggleOpen,
  onCancelTask,
  onClearCompleted,
}) => {
  const activeCount = tasks.filter((t) => t.status === 'active').length;

  if (tasks.length === 0) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="border-t border-[var(--theme-border,#1e2640)] bg-[var(--theme-bg-dark,#070913)] shadow-2xl z-30 select-none">
      {/* Header Bar */}
      <div
        onClick={onToggleOpen}
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-xs"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            {activeCount > 0 ? (
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Transfers</span>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                {activeCount} active
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">({tasks.length} total jobs)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearCompleted();
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-[11px] flex items-center gap-1"
            title="Clear completed and failed jobs"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Clear Done</span>
          </button>
          <button className="p-1 rounded text-slate-400 hover:text-white">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Task List */}
      {isOpen && (
        <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border-t border-[var(--theme-border,#1e2640)]/60 bg-[#090b14] text-xs">
          {tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isFailed = task.status === 'failed';
            const isAborted = task.status === 'aborted';
            const isActive = task.status === 'active';

            return (
              <div key={task.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  {/* Filename & Direction */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-semibold text-slate-200 truncate" title={task.filename}>
                      {task.filename}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 truncate">
                      <span className="text-cyan-400 truncate">{task.sourceTitle}</span>
                      <ArrowRight className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
                      <span className="text-emerald-400 truncate">{task.destTitle}</span>
                    </div>
                  </div>

                  {/* Status & Cancel */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isActive && (
                      <>
                        <span className="text-[11px] font-mono text-cyan-300">{task.progress}%</span>
                        <button
                          onClick={() => onCancelTask(task.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Cancel transfer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                    {isFailed && (
                      <span
                        className="flex items-center gap-1 text-rose-400 text-[11px] font-medium"
                        title={task.error}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Failed</span>
                      </span>
                    )}
                    {isAborted && (
                      <span className="flex items-center gap-1 text-amber-400 text-[11px] font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancelled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {isActive && (
                  <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div
                      className="bg-cyan-400 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}

                {/* Details subtitle */}
                {task.currentFile && isActive && (
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    Transferring: {task.currentFile}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
