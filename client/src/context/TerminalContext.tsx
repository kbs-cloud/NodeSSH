import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
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
  }) => string;
  closeTab: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  renameTab: (tabId: string, newTitle: string) => void;
  pinTab: (tabId: string) => void;
  setActiveTabId: (id: string) => void;
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
  sftpCurrentPath: string;
  setSftpCurrentPath: (path: string) => void;
  syncSftpWithTerminalCwd: () => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>(() => [
    {
      id: 'tab-1',
      title: 'Production Web (Ubuntu)',
      profile: {
        id: 'prof-1',
        name: 'Production Web',
        host: '192.168.1.150',
        port: 22,
        username: 'ubuntu',
      },
      status: 'connected',
      cwd: '/home/ubuntu',
      cols: 80,
      rows: 24,
      createdAt: Date.now(),
      lastActive: Date.now(),
      closeOnTabClose: true,
      latencyMs: 14,
    },
  ]);

  const [activeTabId, setActiveTabId] = useState<string | null>('tab-1');

  const [splitState, setSplitState] = useState<TerminalSplitState>({
    mode: 'single',
    primaryTabId: 'tab-1',
    secondaryTabId: null,
    splitRatio: 0.5,
  });

  const [isMultiExecActive, setIsMultiExecActive] = useState<boolean>(false);

  // SFTP state
  const [isSftpDocked, setIsSftpDocked] = useState<boolean>(false);
  const [sftpDockPosition, setSftpDockPosition] = useState<'left' | 'right'>('right');
  const [sftpCurrentPath, setSftpCurrentPath] = useState<string>('/home/ubuntu');

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
    }): string => {
      const newId = 'tab-' + Date.now();
      const title =
        options?.title ||
        (options?.profile?.name
          ? options.profile.name
          : options?.profile?.host
          ? `${options.profile.username || 'user'}@${options.profile.host}`
          : `Terminal ${tabs.length + 1}`);

      const newTab: TerminalTab = {
        id: newId,
        title,
        profile: options?.profile,
        profileId: options?.profile?.id,
        status: 'connecting',
        cwd: options?.profile?.defaultPath || '/home/ubuntu',
        cols: 80,
        rows: 24,
        createdAt: Date.now(),
        lastActive: Date.now(),
        closeOnTabClose: options?.profile?.closeSessionOnExit ?? true,
        initialCommand: options?.initialCommand || options?.profile?.startupCommand,
        latencyMs: 12,
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newId);

      // If in split mode and secondaryTab is empty, attach to secondary
      if (splitState.mode !== 'single' && !splitState.secondaryTabId) {
        setSplitState(prev => ({ ...prev, secondaryTabId: newId }));
      }

      return newId;
    },
    [tabs.length, splitState.mode, splitState.secondaryTabId]
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
          // Keep at least one tab open
          const fallbackId = 'tab-' + Date.now();
          setActiveTabId(fallbackId);
          return [
            {
              id: fallbackId,
              title: 'Local Terminal',
              status: 'connected',
              cwd: '/home/ubuntu',
              cols: 80,
              rows: 24,
              createdAt: Date.now(),
              lastActive: Date.now(),
              closeOnTabClose: true,
              latencyMs: 8,
            },
          ];
        }

        if (activeTabId === tabId) {
          const nextTab = filtered[filtered.length - 1];
          setActiveTabId(nextTab.id);
        }

        return filtered;
      });

      // Update split view if closed tab was active in split
      setSplitState(prev => {
        if (prev.secondaryTabId === tabId) {
          return { ...prev, secondaryTabId: null, mode: 'single' };
        }
        if (prev.primaryTabId === tabId) {
          const remaining = tabs.filter(t => t.id !== tabId);
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

  const duplicateTab = useCallback(
    (tabId: string) => {
      const source = tabs.find(t => t.id === tabId);
      if (source) {
        addTab({
          profile: source.profile,
          title: `${source.title} (Copy)`,
          initialCommand: source.initialCommand,
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
                cwd: '/home/ubuntu',
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

  const toggleSftpDock = useCallback(() => {
    setIsSftpDocked(prev => !prev);
  }, []);

  const syncSftpWithTerminalCwd = useCallback(() => {
    if (activeTab?.cwd) {
      setSftpCurrentPath(activeTab.cwd);
    }
  }, [activeTab?.cwd]);

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
        sftpCurrentPath,
        setSftpCurrentPath,
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
