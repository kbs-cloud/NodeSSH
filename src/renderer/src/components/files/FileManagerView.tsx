import React, { useState, useEffect, useRef } from 'react';
import {
  Columns2,
  Columns3,
  Grid2X2,
  Square,
  Plus,
  FolderTree,
  ArrowLeftRight,
  Activity,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  FilePaneConfig,
  LocalDriveInfo,
  QuickLocation,
  CrossTransferTask,
  SFTPFileItem,
  ServerProfile,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { useTerminal } from '../../context/TerminalContext';
import { api } from '../../services/api';
import { FilePane } from './FilePane';
import { DirectConnectModal } from './DirectConnectModal';
import { TransferQueueDrawer } from './TransferQueueDrawer';

export const FileManagerView: React.FC = () => {
  const { profiles, showToast } = useApp();
  const { tabs: terminalTabs } = useTerminal();

  // Local filesystem drives & quick locations
  const [drives, setDrives] = useState<LocalDriveInfo[]>([]);
  const [quickLocations, setQuickLocations] = useState<QuickLocation[]>([]);
  const [homeDir, setHomeDir] = useState<string>('');

  useEffect(() => {
    api.getLocalDrives().then((res) => {
      if (res.drives) setDrives(res.drives);
      if (res.quickLocations) setQuickLocations(res.quickLocations);
      if (res.homeDir) setHomeDir(res.homeDir);
    }).catch(() => {});
  }, []);

  // Split Panes State
  const [panes, setPanes] = useState<FilePaneConfig[]>(() => {
    // Initial 2 panes: Left is Local, Right is Unassigned (choose an existing session or start a new one)
    const initialLocal: FilePaneConfig = {
      id: 'pane-local-' + Date.now(),
      sessionType: 'local',
      title: 'Local Filesystem',
      currentPath: '',
      history: [],
      historyIndex: 0,
      searchFilter: '',
      showHidden: true,
      selectedPaths: [],
    };

    const initialRemote: FilePaneConfig = {
      id: 'pane-sftp-' + (Date.now() + 1),
      sessionType: 'unassigned',
      title: 'Select Session',
      currentPath: '',
      history: [],
      historyIndex: 0,
      searchFilter: '',
      showHidden: true,
      selectedPaths: [],
    };

    return [initialLocal, initialRemote];
  });

  // Layout mode
  const [layoutMode, setLayoutMode] = useState<'single' | 'dual' | 'triple' | 'quad'>('dual');

  // Direct Connect Modal state
  const [isDirectConnectOpen, setIsDirectConnectOpen] = useState(false);
  const [targetPaneIdForConnect, setTargetPaneIdForConnect] = useState<string | null>(null);

  // Transfer Queue state
  const [tasks, setTasks] = useState<CrossTransferTask[]>([]);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(true);
  const activeAbortControllers = useRef<Map<string, AbortController>>(new Map());

  // Update Pane configuration
  const handleUpdatePane = (paneId: string, updates: Partial<FilePaneConfig>) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, ...updates } : p))
    );
  };

  // Add new Pane
  const handleAddPane = () => {
    if (panes.length >= 6) {
      showToast('Maximum 6 split panes supported simultaneously', 'info');
      return;
    }

    const newPaneId = 'pane-' + Date.now();
    const newPane: FilePaneConfig = {
      id: newPaneId,
      sessionType: 'unassigned',
      title: 'Select Session',
      currentPath: '',
      history: [],
      historyIndex: 0,
      searchFilter: '',
      showHidden: true,
      selectedPaths: [],
    };

    setPanes((prev) => [...prev, newPane]);
    if (panes.length === 1) setLayoutMode('dual');
    else if (panes.length === 2) setLayoutMode('triple');
    else if (panes.length >= 3) setLayoutMode('quad');
  };

  // Close Pane
  const handleClosePane = (paneId: string) => {
    if (panes.length <= 1) return;
    setPanes((prev) => prev.filter((p) => p.id !== paneId));
  };

  // Swap Panes (Left <-> Right)
  const handleSwapPanes = () => {
    if (panes.length < 2) return;
    setPanes((prev) => {
      const copy = [...prev];
      const temp = copy[0];
      copy[0] = copy[1];
      copy[1] = temp;
      return copy;
    });
  };

  // Standalone SFTP direct connection callback
  const handleDirectConnect = (profile: Partial<ServerProfile>) => {
    if (targetPaneIdForConnect) {
      handleUpdatePane(targetPaneIdForConnect, {
        sessionType: 'sftp',
        title: profile.name || `${profile.username}@${profile.host}`,
        profileId: profile.id,
        profile,
        currentPath: profile.defaultPath || '/',
      });
      setTargetPaneIdForConnect(null);
    } else {
      // Create new pane with connected SFTP session
      const newPane: FilePaneConfig = {
        id: 'pane-sftp-' + Date.now(),
        sessionType: 'sftp',
        title: profile.name || `${profile.username}@${profile.host}`,
        profileId: profile.id,
        profile,
        currentPath: profile.defaultPath || '/',
        history: [],
        historyIndex: 0,
        searchFilter: '',
        showHidden: true,
        selectedPaths: [],
      };
      setPanes((prev) => [...prev, newPane]);
    }
  };

  // Initiate Cross-Session Transfer between Panes
  const handleInitiateTransfer = async (
    sourcePane: FilePaneConfig,
    targetPane: FilePaneConfig,
    items: SFTPFileItem[],
    targetSubdir?: string
  ) => {
    if (items.length === 0) return;

    const destDir = targetSubdir || targetPane.currentPath;

    for (const item of items) {
      const taskId = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const abortController = new AbortController();
      activeAbortControllers.current.set(taskId, abortController);

      const newTask: CrossTransferTask = {
        id: taskId,
        filename: item.name,
        sourceType: sourcePane.sessionType === 'local' ? 'local' : 'sftp',
        sourcePath: item.path,
        sourceTitle: sourcePane.title,
        destType: targetPane.sessionType === 'local' ? 'local' : 'sftp',
        destDir,
        destTitle: targetPane.title,
        progress: 0,
        loaded: 0,
        total: item.size || 0,
        status: 'active',
        startTime: Date.now(),
      };

      setTasks((prev) => [newTask, ...prev]);
      setIsQueueDrawerOpen(true);

      api.transferCrossSession(
        {
          transferId: taskId,
          sourceType: newTask.sourceType,
          sourcePath: item.path,
          sourceTarget: sourcePane.profile,
          destType: newTask.destType,
          destDir,
          destTarget: targetPane.profile,
        },
        (percent, loaded, total, details) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    progress: percent,
                    loaded: loaded || t.loaded,
                    total: total || t.total,
                    currentFile: details?.currentFile,
                  }
                : t
            )
          );
        },
        abortController.signal
      )
        .then(() => {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
          );
          showToast(`Transferred "${item.name}" to ${targetPane.title}`, 'success');
          // Trigger refresh of target and source panes
          triggerPaneRefresh(targetPane.id);
          triggerPaneRefresh(sourcePane.id);
        })
        .catch((err: any) => {
          const isAborted = abortController.signal.aborted || err.message === 'Transfer aborted';
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, status: isAborted ? 'aborted' : 'failed', error: err.message }
                : t
            )
          );
          if (!isAborted) {
            showToast(`Transfer failed for "${item.name}": ${err.message}`, 'error');
          }
          // Also refresh on cancel or error in case partial state was created
          triggerPaneRefresh(targetPane.id);
          triggerPaneRefresh(sourcePane.id);
        })
        .finally(() => {
          activeAbortControllers.current.delete(taskId);
        });
    }
  };

  const triggerPaneRefresh = (paneId: string) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, refreshKey: (p.refreshKey || 0) + 1 } : p))
    );
  };

  const handleCancelTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const controller = activeAbortControllers.current.get(taskId);
    if (controller) {
      controller.abort();
      activeAbortControllers.current.delete(taskId);
    }
    api.abortTransfer(taskId).catch(() => {});
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'aborted' } : t))
    );
    // Auto-refresh destination pane and source pane immediately on cancel
    if (task) {
      const destP = panes.find((p) => p.title === task.destTitle || p.currentPath === task.destDir);
      if (destP) triggerPaneRefresh(destP.id);
      const srcP = panes.find((p) => p.title === task.sourceTitle || p.currentPath === task.sourcePath);
      if (srcP) triggerPaneRefresh(srcP.id);
    }
  };

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status === 'active'));
  };

  const activeTransferCount = tasks.filter((t) => t.status === 'active').length;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[var(--theme-bg-dark,#070913)] text-[var(--theme-text,#e2e8f0)] select-none">
      {/* Top File Manager Navigation / Toolbar Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--theme-bg-surface,#0e1222)] border-b border-[var(--theme-border,#1e2640)] text-xs z-10">
        {/* Left: View Title & Active Panes Count */}
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-sm tracking-wide text-white">File Manager</span>
          <span className="text-[11px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
            {panes.length} {panes.length === 1 ? 'Pane' : 'Split Panes'}
          </span>
        </div>

        {/* Center: Layout & Split Presets */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setLayoutMode('single')}
            className={`p-1 rounded transition-colors ${
              layoutMode === 'single' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Single Pane View"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayoutMode('dual')}
            className={`p-1 rounded transition-colors ${
              layoutMode === 'dual' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Dual Split View (50/50)"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayoutMode('triple')}
            className={`p-1 rounded transition-colors ${
              layoutMode === 'triple' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Triple Split View (33/33/33)"
          >
            <Columns3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayoutMode('quad')}
            className={`p-1 rounded transition-colors ${
              layoutMode === 'quad' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Quad Grid View (2x2)"
          >
            <Grid2X2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {panes.length >= 2 && (
            <button
              onClick={handleSwapPanes}
              className="px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 text-xs border border-white/10"
              title="Swap primary panes"
            >
              <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
              <span className="hidden md:inline">Swap</span>
            </button>
          )}

          <button
            onClick={() => {
              setTargetPaneIdForConnect(null);
              setIsDirectConnectOpen(true);
            }}
            className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-medium flex items-center gap-1.5 transition-colors text-xs"
            title="Connect directly to an SFTP server"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Connect SFTP</span>
          </button>

          <button
            onClick={handleAddPane}
            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition-colors text-xs"
            title="Add another explorer split pane"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Pane</span>
          </button>

          {/* Transfers Drawer Toggle Badge */}
          {tasks.length > 0 && (
            <button
              onClick={() => setIsQueueDrawerOpen(!isQueueDrawerOpen)}
              className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                activeTransferCount > 0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                  : 'bg-black/40 text-slate-400 border-white/10'
              }`}
              title="Toggle Transfer Queue"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Transfers ({activeTransferCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Panes Viewport Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div
          className={`h-full w-full ${
            layoutMode === 'quad'
              ? 'grid grid-cols-2 grid-rows-2'
              : 'flex flex-row'
          } overflow-hidden`}
        >
          {panes
            .slice(0, layoutMode === 'single' ? 1 : layoutMode === 'dual' ? 2 : layoutMode === 'triple' ? 3 : 4)
            .map((pane) => (
              <div key={pane.id} className="flex-1 h-full min-w-0 min-h-0 overflow-hidden flex flex-col">
                <FilePane
                  pane={pane}
                  panes={panes}
                  profiles={profiles}
                  terminalTabs={terminalTabs}
                  drives={drives}
                  quickLocations={quickLocations}
                  onUpdatePane={handleUpdatePane}
                  onClosePane={panes.length > 1 ? () => handleClosePane(pane.id) : undefined}
                  onOpenDirectConnect={() => {
                    setTargetPaneIdForConnect(pane.id);
                    setIsDirectConnectOpen(true);
                  }}
                  onInitiateTransfer={handleInitiateTransfer}
                />
              </div>
            ))}
        </div>
      </div>

      {/* Bottom Transfer Queue Drawer */}
      <TransferQueueDrawer
        tasks={tasks}
        isOpen={isQueueDrawerOpen}
        onToggleOpen={() => setIsQueueDrawerOpen(!isQueueDrawerOpen)}
        onCancelTask={handleCancelTask}
        onClearCompleted={handleClearCompleted}
      />

      {/* Direct SFTP Connection Modal */}
      <DirectConnectModal
        isOpen={isDirectConnectOpen}
        onClose={() => setIsDirectConnectOpen(false)}
        onConnect={handleDirectConnect}
      />
    </div>
  );
};
