import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { TerminalTab } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { TerminalSession } from '../../services/terminalSession';
import { TerminalSearchBar } from './TerminalSearchBar';
import { MultiLinePasteModal } from './MultiLinePasteModal';
import { RotateCcw, X } from 'lucide-react';

interface XtermViewProps {
  tab: TerminalTab;
  isFocused?: boolean;
}

function resolvePathWithUser(rawPath: string, profile?: Partial<ServerProfile>): string {
  let clean = rawPath.trim();
  if (clean.startsWith('~')) {
    const home =
      profile?.defaultPath ||
      (profile?.username === 'root'
        ? '/root'
        : profile?.username
        ? `/home/${profile.username}`
        : '/root');
    clean = clean.replace(/^~(?=\/|$)/, home);
  }
  if (!clean.startsWith('/') && !clean.startsWith('C:') && !clean.startsWith('D:')) {
    clean = '/' + clean;
  }
  clean = clean.replace(/\/+/g, '/');
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

function extractCwdFromTerminalData(data: string, profile?: Partial<ServerProfile>): string | null {
  // 1. OSC 7 sequence: \x1b]7;file://[hostname](/path)\x07 or \x1b\
  const osc7Match = data.match(/\x1b\]7;file:\/\/[^\/]*(\/[^\x07\x1b\\]+)[\x07\x1b\\]/);
  if (osc7Match && osc7Match[1]) {
    try {
      const rawCwd = decodeURIComponent(osc7Match[1]);
      return resolvePathWithUser(rawCwd, profile);
    } catch {}
  }

  // 2. OSC 0 or OSC 2 window title sequence: \x1b]0;Title\x07 or \x1b]2;Title\x07
  // Formats often: "user@host: ~/dir", "user@host: /path", "host: /path", "/path"
  const oscTitleMatch = data.match(/\x1b\][02];([^\x07\x1b\\]+)[\x07\x1b\\]/);
  if (oscTitleMatch && oscTitleMatch[1]) {
    const title = oscTitleMatch[1].trim();
    const pathInTitleMatch = title.match(/(?:[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+[:\s]+|[a-zA-Z0-9_.-]+[:\s]+)?([/~][^\x07\x1b\\:\s]*)$/);
    if (pathInTitleMatch && pathInTitleMatch[1]) {
      return resolvePathWithUser(pathInTitleMatch[1], profile);
    }
  }

  // 3. Shell Prompts (strip ANSI codes first)
  const stripped = data.replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b\([AB0-2]|\x1b\[\?[0-9;]*[a-zA-Z]/g, '');

  // Bash / Zsh prompt: user@host:path[$#%] or [user@host path][$#%]
  const promptMatch = stripped.match(/(?:[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+[:\s]+|\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s+)([/~][a-zA-Z0-9_./@~-]*)\]?\s*[$#%>\u279c]\s*$/);
  if (promptMatch && promptMatch[1]) {
    return resolvePathWithUser(promptMatch[1], profile);
  }

  // Bracketed prompt [user@host /path]
  const bracketMatch = stripped.match(/\[[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s+([/~][a-zA-Z0-9_./@~-]*)\]\s*[$#]\s*$/);
  if (bracketMatch && bracketMatch[1]) {
    return resolvePathWithUser(bracketMatch[1], profile);
  }

  // Simple prompt format: ~/directory % or /directory $
  const simplePromptMatch = stripped.match(/(?:^|[\r\n])\s*([/~][a-zA-Z0-9_./@~-]+)\s*[$#%]\s*$/);
  if (simplePromptMatch && simplePromptMatch[1]) {
    return resolvePathWithUser(simplePromptMatch[1], profile);
  }

  return null;
}

export const XtermView: React.FC<XtermViewProps> = ({ tab, isFocused = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingPasteText, setPendingPasteText] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { xtermTheme } = useTheme();
  const { settings } = useApp();
  const {
    registerSession,
    unregisterSession,
    updateTab,
    closeTab,
    isMultiExecActive,
    broadcastInput,
  } = useTerminal();

  const tabRef = useRef(tab);
  tabRef.current = tab;

  // Keep refs for current settings and callbacks to use inside stable event listeners
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const isMultiExecActiveRef = useRef(isMultiExecActive);
  isMultiExecActiveRef.current = isMultiExecActive;

  const broadcastInputRef = useRef(broadcastInput);
  broadcastInputRef.current = broadcastInput;

  // Paste Execution Handler
  const handleDirectPaste = useCallback((text: string) => {
    if (!text) return;
    if (isMultiExecActiveRef.current) {
      broadcastInputRef.current(text);
    } else {
      sessionRef.current?.sendInput(text);
    }
    setTimeout(() => terminalRef.current?.focus(), 10);
  }, []);

  // Process paste text (trigger safety confirmation if multiline)
  const processPaste = useCallback((text: string) => {
    if (!text) return;
    const hasNewlines = text.includes('\n') || text.includes('\r');
    if (hasNewlines && settingsRef.current.confirmMultiLinePaste !== false) {
      setPendingPasteText(text);
    } else {
      handleDirectPaste(text);
    }
  }, [handleDirectPaste]);

  const processPasteRef = useRef(processPaste);
  processPasteRef.current = processPaste;

  // Read clipboard and process
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        processPasteRef.current(text);
      }
    } catch (err) {
      console.warn('Failed to read clipboard', err);
    }
  }, []);

  const handlePasteFromClipboardRef = useRef(handlePasteFromClipboard);
  handlePasteFromClipboardRef.current = handlePasteFromClipboard;

  // Right-click Context Menu Handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (settingsRef.current.rightClickPaste !== false) {
      e.preventDefault();
      handlePasteFromClipboard();
    }
  }, [handlePasteFromClipboard]);

  // Initialize Terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: xtermTheme,
      fontFamily: settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: settings.fontSize || 14,
      cursorBlink: settings.cursorBlink ?? true,
      cursorStyle: settings.cursorStyle || 'block',
      allowTransparency: true,
      scrollback: 10000,
      tabStopWidth: 4,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    try {
      term.loadAddon(fitAddon);
      term.loadAddon(searchAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = '11';
    } catch (e) {
      console.warn('Failed to load addons', e);
    }

    term.open(containerRef.current);

    try {
      fitAddon.fit();
    } catch {
      // Ignore if container not yet sized
    }

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Create session
    const session = new TerminalSession({
      tabId: tab.id,
      profile: tab.profile,
      initialCommand: tab.initialCommand,
      cols: term.cols,
      rows: term.rows,
      onData: (data: string) => {
        // Dynamic remote directory detection (OSC 7, Window Title OSC 0/2, Shell Prompts)
        const detectedCwd = extractCwdFromTerminalData(data, tabRef.current.profile);
        if (detectedCwd && detectedCwd !== tabRef.current.cwd) {
          const currentTab = tabRef.current;
          const updates: Partial<TerminalTab> = { cwd: detectedCwd };
          if (currentTab.sftpAutoSync !== false) {
            updates.sftpPath = detectedCwd;
          }
          updateTab(currentTab.id, updates);
        }
        term.write(data);
      },
      onStatusChange: (status) => {
        updateTab(tab.id, { status });
      },
      onCwdChange: (cwd: string) => {
        const currentTab = tabRef.current;
        const resolved = resolvePathWithUser(cwd, currentTab.profile);
        const updates: Partial<TerminalTab> = { cwd: resolved };
        if (currentTab.sftpAutoSync !== false) {
          updates.sftpPath = resolved;
        }
        updateTab(currentTab.id, updates);
      },
      onLatencyChange: (latencyMs: number) => {
        updateTab(tab.id, { latencyMs });
      },
    });

    sessionRef.current = session;
    registerSession(tab.id, session);

    // Terminal data input listener
    const onDataDisposable = term.onData((data: string) => {
      const currentTab = tabRef.current;
      if (currentTab.status === 'disconnected' || currentTab.status === 'error') {
        const lower = data.toLowerCase();
        if (lower === 'r') {
          sessionRef.current?.reconnect();
          return;
        }
        if (lower === 'x') {
          closeTab(currentTab.id);
          return;
        }
        return;
      }
      if (isMultiExecActiveRef.current) {
        broadcastInputRef.current(data);
      } else {
        session.sendInput(data);
      }
    });

    // Copy on selection listener
    const onSelectionDisposable = term.onSelectionChange(() => {
      if (settingsRef.current.copyOnSelect !== false && term.hasSelection()) {
        const selectedText = term.getSelection();
        if (selectedText && selectedText.length > 0) {
          navigator.clipboard.writeText(selectedText).catch(() => {});
        }
      }
    });

    // Custom Key Handler for Ctrl+F search & Paste shortcuts & Disconnect Hotkeys (R to reconnect, Esc/X to close)
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const currentTab = tabRef.current;
      if (currentTab.status === 'disconnected' || currentTab.status === 'error') {
        if (event.type === 'keydown') {
          if (event.key === 'Escape') {
            closeTab(currentTab.id);
            return false;
          }
          if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.altKey && !event.metaKey) {
            sessionRef.current?.reconnect();
            return false;
          }
          if (event.key.toLowerCase() === 'x' && !event.ctrlKey && !event.altKey && !event.metaKey) {
            closeTab(currentTab.id);
            return false;
          }
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        if (event.type === 'keydown') {
          setIsSearchOpen(true);
        }
        return false;
      }
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') ||
        (event.shiftKey && event.key === 'Insert')
      ) {
        if (event.type === 'keydown') {
          handlePasteFromClipboardRef.current();
        }
        return false;
      }
      return true;
    });

    // Focus terminal
    if (isFocused) {
      setTimeout(() => term.focus(), 50);
    }

    // Resize observer with requestAnimationFrame debouncing
    const resizeObserver = new ResizeObserver(() => {
      if (!fitAddonRef.current || !terminalRef.current) return;
      window.requestAnimationFrame(() => {
        try {
          if (
            containerRef.current &&
            containerRef.current.clientWidth > 0 &&
            containerRef.current.clientHeight > 0
          ) {
            fitAddonRef.current?.fit();
            if (terminalRef.current) {
              const cols = terminalRef.current.cols;
              const rows = terminalRef.current.rows;
              if (cols > 0 && rows > 0) {
                updateTab(tab.id, { cols, rows });
                sessionRef.current?.resize(cols, rows);
              }
            }
          }
        } catch {}
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      onDataDisposable.dispose();
      onSelectionDisposable.dispose();
      resizeObserver.disconnect();
      unregisterSession(tab.id);
      term.dispose();
    };
  }, [tab.id]);

  // Update theme when theme changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = xtermTheme;
    }
  }, [xtermTheme]);

  // Update font settings
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = settings.fontSize;
      terminalRef.current.options.fontFamily = settings.fontFamily;
      terminalRef.current.options.cursorStyle = settings.cursorStyle;
      terminalRef.current.options.cursorBlink = settings.cursorBlink;
      fitAddonRef.current?.fit();
    }
  }, [settings]);

  // Focus and re-fit when tab becomes active
  useEffect(() => {
    if (isFocused && terminalRef.current && containerRef.current) {
      const timer = setTimeout(() => {
        try {
          if (
            containerRef.current &&
            containerRef.current.clientWidth > 0 &&
            containerRef.current.clientHeight > 0
          ) {
            fitAddonRef.current?.fit();
            if (terminalRef.current) {
              const cols = terminalRef.current.cols;
              const rows = terminalRef.current.rows;
              if (cols > 0 && rows > 0) {
                updateTab(tab.id, { cols, rows });
                sessionRef.current?.resize(cols, rows);
              }
            }
            terminalRef.current?.focus();
          }
        } catch {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isFocused, tab.id, updateTab]);

  return (
    <div
      className={`relative w-full h-full bg-[var(--theme-bg-dark,#070913)] overflow-hidden flex flex-col transition-all ${
        isDragOver ? 'ring-2 ring-cyan-400 ring-inset' : ''
      }`}
      onClick={() => terminalRef.current?.focus()}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const path = e.dataTransfer.getData('text/plain');
        if (path && path.trim()) {
          const pathText = `"${path.trim()}" `;
          if (isMultiExecActiveRef.current) {
            broadcastInputRef.current(pathText);
          } else {
            sessionRef.current?.sendInput(pathText);
          }
          setTimeout(() => terminalRef.current?.focus(), 10);
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain');
        if (text) {
          processPaste(text);
        } else {
          handlePasteFromClipboard();
        }
      }}
    >
      {isSearchOpen && (
        <TerminalSearchBar
          searchAddon={searchAddonRef.current}
          onClose={() => {
            setIsSearchOpen(false);
            terminalRef.current?.focus();
          }}
        />
      )}
      {pendingPasteText !== null && (
        <MultiLinePasteModal
          isOpen={true}
          text={pendingPasteText}
          onConfirm={() => {
            handleDirectPaste(pendingPasteText);
            setPendingPasteText(null);
          }}
          onClose={() => {
            setPendingPasteText(null);
            terminalRef.current?.focus();
          }}
        />
      )}

      {/* Drag and Drop visual indicator */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 pointer-events-none bg-cyan-950/40 border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-2 backdrop-blur-[1px] transition-all">
          <div className="bg-[#0e1222]/95 border border-cyan-500/50 px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2.5 text-cyan-300 font-mono text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold">Drop to insert path into active terminal session</span>
          </div>
        </div>
      )}

      {(tab.status === 'disconnected' || tab.status === 'error') && (
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0e1222]/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs font-mono select-none pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
          <span className="text-slate-300">Session ended</span>
          <button
            onClick={() => sessionRef.current?.reconnect()}
            className="ml-1 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold hover:text-cyan-200 transition-all flex items-center gap-1.5 cursor-pointer border border-cyan-500/30"
            title="Reconnect (Press R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reconnect (R)</span>
          </button>
          <button
            onClick={() => closeTab(tab.id)}
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all flex items-center gap-1 cursor-pointer border border-slate-700/50"
            title="Close Tab (Press Esc or X)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close (Esc)</span>
          </button>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full flex-1" />
    </div>
  );
};
