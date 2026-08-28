import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { TerminalTab, ServerProfile, TerminalSplitState } from '../types';
import { TerminalSession } from '../services/terminalSession';

interface TerminalContextType {
  tabs: TerminalTab[];
  activeTabId: string | null;
  activeTab: TerminalTab | undefined;
  secondaryTab: TerminalTab | undefined;
  splitState: TerminalSplitState;

  // Tab operations
  addTab: (options?: {
    profile?: Partial<ServerProfile>;
    title?: string;
    initialCommand?: string;
    insertAfterTabId?: string;
  }) => string;
  closeTab: (tabId: string) => void;
  reconnectTab: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  renameTab: (tabId: string, newTitle: string) => void;
  pinTab: (tabId: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateTab: (id: string, updates: Partial<TerminalTab>) => void;

  // Split view
  setSplitMode: (mode: 'single' | 'horizontal' | 'vertical', secondaryId?: string) => void;
  setSplitRatio: (ratio: number) => void;
  swapSplitTabs: () => void;

  // Multi-Exec broadcast
  isMultiExecActive: boolean;
  setIsMultiExecActive: (active: boolean) => void;
  toggleMultiExec: () => void;
  broadcastInput: (input: string) => void;
  broadcastCommand: (cmd: string) => void;

  // Sessions map
  registerSession: (tabId: string, session: TerminalSession) => void;
  unregisterSession: (tabId: string) => void;
  getSession: (tabId: string) => TerminalSession | undefined;
  sendInputToActiveTab: (data: string) => void;

  // SFTP Drawer & Sync
  isSftpDocked: boolean;
  setIsSftpDocked: (docked: boolean) => void;
  toggleSftpDock: () => void;
  sftpDockPosition: 'left' | 'right';
  setSftpDockPosition: (pos: 'left' | 'right') => void;
  sftpDockWidth: number;
  setSftpDockWidth: (width: number) => void;
  sftpCurrentPath: string;
  setSftpCurrentPath: (path: string, tabId?: string) => void;
  isSftpAutoSync: boolean;
  toggleSftpAutoSync: (tabId?: string) => void;
  syncSftpWithTerminalCwd: (tabId?: string) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);

  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [splitState, setSplitState] = useState<TerminalSplitState>({
    mode: 'single',
    primaryTabId: null,
    secondaryTabId: null,
    splitRatio: 0.5,
  });

  const [isMultiExecActive, setIsMultiExecActive] = useState<boolean>(false);

  // SFTP state
  const [isSftpDocked, setIsSftpDocked] = useState<boolean>(false);
  const [sftpDockPosition, setSftpDockPosition] = useState<'left' | 'right'>('right');
  const [sftpDockWidth, setSftpDockWidthState] = useState<number>(() => {
    const saved = localStorage.getItem('nodessh_sftp_dock_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 240 && parsed <= 1200) {
        return parsed;
      }
    }
    return 360;
  });

  const setSftpDockWidth = useCallback((width: number) => {
    const clamped = Math.max(240, Math.min(1200, Math.round(width)));
    setSftpDockWidthState(clamped);
    try {
      localStorage.setItem('nodessh_sftp_dock_width', String(clamped));
    } catch {
      // ignore storage error
    }
  }, []);

  // Sessions map reference (to avoid re-rendering entire tree on input)
  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map());

  const registerSession = useCallback((tabId: string, session: TerminalSession) => {
    sessionsRef.current.set(tabId, session);
  }, []);

  const unregisterSession = useCallback((tabId: string) => {
    const session = sessionsRef.current.get(tabId);
    if (session) {
      session.disconnect(true);
      sessionsRef.current.delete(tabId);
    }
  }, []);

  const getSession = useCallback((tabId: string) => {
    return sessionsRef.current.get(tabId);
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const secondaryTab = tabs.find(t => t.id === splitState.secondaryTabId);

  const addTab = useCallback(
    (options?: {
      profile?: Partial<ServerProfile>;
      title?: string;
      initialCommand?: string;
      insertAfterTabId?: string;
    }): string => {
      const effectiveProfile = options?.profile;
      const effectiveTitle =
        options?.title ||
        (effectiveProfile?.name
          ? effectiveProfile.name
          : effectiveProfile?.host
          ? `${effectiveProfile.username || 'user'}@${effectiveProfile.host}`
          : 'Local Shell');

      const effectiveCommand = options?.initialCommand || effectiveProfile?.startupCommand;

      const newId = 'tab-' + Date.now();

      const effectiveCwd =
        effectiveProfile?.defaultPath ||
        (effectiveProfile?.username === 'root'
          ? '/root'
          : effectiveProfile?.username
          ? `/home/${effectiveProfile.username}`
          : '~');

      const effectiveSftpPath =
        effectiveProfile?.defaultPath ||
        (effectiveProfile?.username === 'root'
          ? '/root'
          : effectiveProfile?.username
          ? `/home/${effectiveProfile.username}`
          : '');

      const newTab: TerminalTab = {
        id: newId,
        title: effectiveTitle,
        profile: effectiveProfile,
        profileId: effectiveProfile?.id,
        status: 'connecting',
        cwd: effectiveCwd,
        sftpPath: effectiveSftpPath,
        sftpAutoSync: true,
        cols: 80,
        rows: 24,
        createdAt: Date.now(),
        lastActive: Date.now(),
        closeOnTabClose: effectiveProfile?.closeSessionOnExit ?? true,
        initialCommand: effectiveCommand,
        latencyMs: 12,
      };

      setTabs(prev => {
        if (options?.insertAfterTabId) {
          const index = prev.findIndex(t => t.id === options.insertAfterTabId);
          if (index >= 0) {
            const nextTabs = [...prev];
            nextTabs.splice(index + 1, 0, newTab);
            return nextTabs;
          }
        }
        return [...prev, newTab];
      });
      setActiveTabId(newId);

      // If in split mode and secondaryTab is empty, attach to secondary
      if (splitState.mode !== 'single' && !splitState.secondaryTabId) {
        setSplitState(prev => ({ ...prev, secondaryTabId: newId }));
      }

      return newId;
    },
    [tabs, activeTabId, splitState.mode, splitState.secondaryTabId]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const tabToClose = tabs.find(t => t.id === tabId);
      if (tabToClose) {
        const session = sessionsRef.current.get(tabId);
        if (session) {
          session.disconnect(tabToClose.closeOnTabClose);
          sessionsRef.current.delete(tabId);
        }
      }

      setTabs(prev => {
        const filtered = prev.filter(t => t.id !== tabId);
        if (filtered.length === 0) {
          setActiveTabId(null);
          return [];
        }

        if (activeTabId === tabId) {
          const nextTab = filtered[filtered.length - 1];
          setActiveTabId(nextTab.id);
        }

        return filtered;
      });

      // Update split view if closed tab was active in split
      setSplitState(prev => {
        const remaining = tabs.filter(t => t.id !== tabId);
        if (remaining.length === 0) {
          return {
            mode: 'single',
            primaryTabId: null,
            secondaryTabId: null,
            splitRatio: 0.5,
          };
        }
        if (prev.secondaryTabId === tabId) {
          return { ...prev, secondaryTabId: null, mode: 'single' };
        }
        if (prev.primaryTabId === tabId) {
          return {
            ...prev,
            primaryTabId: remaining.length > 0 ? remaining[0].id : null,
            mode: prev.secondaryTabId ? prev.mode : 'single',
          };
        }
        return prev;
      });
    },
    [tabs, activeTabId]
  );

  const reconnectTab = useCallback((tabId: string) => {
    const session = sessionsRef.current.get(tabId);
    if (session) {
      session.reconnect();
    } else {
      setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, status: 'connecting' } : t)));
    }
  }, []);

  const duplicateTab = useCallback(
    (tabId: string) => {
      const source = tabs.find(t => t.id === tabId);
      if (source) {
        return addTab({
          profile: source.profile,
          title: `${source.title} (Copy)`,
          initialCommand: source.initialCommand,
          insertAfterTabId: tabId,
        });
      }
    },
    [tabs, addTab]
  );

  const renameTab = useCallback((tabId: string, newTitle: string) => {
    setTabs(prev =>
      prev.map(t =>
        t.id === tabId ? { ...t, title: newTitle, customTitle: true } : t
      )
    );
  }, []);

  const pinTab = useCallback((tabId: string) => {
    setTabs(prev =>
      prev.map(t =>
        t.id === tabId ? { ...t, isPinned: !t.isPinned } : t
      )
    );
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<TerminalTab>) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const setSplitMode = useCallback(
    (mode: 'single' | 'horizontal' | 'vertical', secondaryId?: string) => {
      setSplitState(prev => {
        let secId = secondaryId || prev.secondaryTabId;
        if (mode !== 'single' && !secId) {
          const otherTab = tabs.find(t => t.id !== activeTabId);
          if (otherTab) {
            secId = otherTab.id;
          } else {
            // Create a second tab for split
            const newId = 'tab-' + Date.now();
            setTabs(curr => [
              ...curr,
              {
                id: newId,
                title: 'Split Shell',
                status: 'connected',
                cwd: '~',
                cols: 80,
                rows: 24,
                createdAt: Date.now(),
                lastActive: Date.now(),
                closeOnTabClose: true,
                latencyMs: 12,
              },
            ]);
            secId = newId;
          }
        }
        return {
          ...prev,
          mode,
          primaryTabId: activeTabId,
          secondaryTabId: mode === 'single' ? null : secId,
        };
      });
    },
    [tabs, activeTabId]
  );

  const setSplitRatio = useCallback((ratio: number) => {
    setSplitState(prev => ({
      ...prev,
      splitRatio: Math.max(0.2, Math.min(0.8, ratio)),
    }));
  }, []);

  const swapSplitTabs = useCallback(() => {
    setSplitState(prev => ({
      ...prev,
      primaryTabId: prev.secondaryTabId,
      secondaryTabId: prev.primaryTabId,
    }));
  }, []);

  const toggleMultiExec = useCallback(() => {
    setIsMultiExecActive(prev => !prev);
  }, []);

  const broadcastInput = useCallback((input: string) => {
    sessionsRef.current.forEach(session => {
      session.sendInput(input);
    });
  }, []);

  const broadcastCommand = useCallback((cmd: string) => {
    sessionsRef.current.forEach(session => {
      session.sendInput(cmd + '\r');
    });
  }, []);

  const sendInputToActiveTab = useCallback(
    (data: string) => {
      if (isMultiExecActive) {
        broadcastInput(data);
      } else if (activeTabId) {
        const session = sessionsRef.current.get(activeTabId);
        session?.sendInput(data);
      }
    },
    [isMultiExecActive, activeTabId, broadcastInput]
  );

  const sftpCurrentPath = activeTab?.sftpPath || activeTab?.cwd || '';
  const isSftpAutoSync = activeTab ? activeTab.sftpAutoSync !== false : true;

  const setSftpCurrentPath = useCallback((path: string, tabId?: string) => {
    const targetId = tabId || activeTabId;
    if (!targetId) return;
    setTabs(prev => prev.map(t => (t.id === targetId ? { ...t, sftpPath: path } : t)));
  }, [activeTabId]);

  const toggleSftpDock = useCallback(() => {
    setIsSftpDocked(prev => !prev);
  }, []);

  const toggleSftpAutoSync = useCallback((tabId?: string) => {
    const targetId = tabId || activeTabId;
    if (!targetId) return;
    setTabs(prev => prev.map(t => {
      if (t.id === targetId) {
        const nextVal = t.sftpAutoSync === false ? true : false;
        return { ...t, sftpAutoSync: nextVal };
      }
      return t;
    }));
  }, [activeTabId]);

  const syncSftpWithTerminalCwd = useCallback((tabId?: string) => {
    const targetId = tabId || activeTabId;
    if (!targetId) return;
    setTabs(prev => prev.map(t => {
      if (t.id === targetId && t.cwd) {
        let clean = t.cwd.trim();
        if (clean.startsWith('~')) {
          const home = t.profile?.defaultPath || (t.profile?.username === 'root' ? '/root' : (t.profile?.username ? `/home/${t.profile.username}` : ''));
          if (home) {
            clean = clean.replace(/^~(?=\/|$)/, home);
          }
        }
        return { ...t, sftpPath: clean };
      }
      return t;
    }));
  }, [activeTabId]);

  return (
    <TerminalContext.Provider
      value={{
        tabs,
        activeTabId,
        activeTab,
        secondaryTab,
        splitState,

        addTab,
        closeTab,
        reconnectTab,
        duplicateTab,
        renameTab,
        pinTab,
        setActiveTabId,
        updateTab,

        setSplitMode,
        setSplitRatio,
        swapSplitTabs,

        isMultiExecActive,
        setIsMultiExecActive,
        toggleMultiExec,
        broadcastInput,
        broadcastCommand,

        registerSession,
        unregisterSession,
        getSession,
        sendInputToActiveTab,

        isSftpDocked,
        setIsSftpDocked,
        toggleSftpDock,
        sftpDockPosition,
        setSftpDockPosition,
        sftpDockWidth,
        setSftpDockWidth,
        sftpCurrentPath,
        setSftpCurrentPath,
        isSftpAutoSync,
        toggleSftpAutoSync,
        syncSftpWithTerminalCwd,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = (): TerminalContextType => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};
