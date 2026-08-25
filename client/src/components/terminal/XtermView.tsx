import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalTab } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { TerminalSession } from '../../services/terminalSession';
import { TerminalSearchBar } from './TerminalSearchBar';

interface XtermViewProps {
  tab: TerminalTab;
  isFocused?: boolean;
}

export const XtermView: React.FC<XtermViewProps> = ({ tab, isFocused = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { xtermTheme } = useTheme();
  const { settings } = useApp();
  const {
    registerSession,
    unregisterSession,
    updateTab,
    isMultiExecActive,
    broadcastInput,
  } = useTerminal();

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
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    try {
      term.loadAddon(fitAddon);
      term.loadAddon(searchAddon);
      term.loadAddon(webLinksAddon);
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
        term.write(data);
      },
      onStatusChange: (status, message) => {
        updateTab(tab.id, { status });
        if (message) {
          term.write(`\r\n\x1b[33m[NodeSSH] ${message}\x1b[0m\r\n`);
        }
      },
      onCwdChange: (cwd: string) => {
        updateTab(tab.id, { cwd });
      },
      onLatencyChange: (latencyMs: number) => {
        updateTab(tab.id, { latencyMs });
      },
    });

    sessionRef.current = session;
    registerSession(tab.id, session);

    // Terminal data input listener
    const onDataDisposable = term.onData((data: string) => {
      if (isMultiExecActive) {
        broadcastInput(data);
      } else {
        session.sendInput(data);
      }
    });

    // Custom Key Handler for Ctrl+F search
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        if (event.type === 'keydown') {
          setIsSearchOpen(true);
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
          fitAddonRef.current?.fit();
          if (terminalRef.current) {
            const cols = terminalRef.current.cols;
            const rows = terminalRef.current.rows;
            updateTab(tab.id, { cols, rows });
            sessionRef.current?.resize(cols, rows);
          }
        } catch {}
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      onDataDisposable.dispose();
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

  // Focus when tab becomes active
  useEffect(() => {
    if (isFocused && terminalRef.current) {
      terminalRef.current.focus();
      fitAddonRef.current?.fit();
    }
  }, [isFocused]);

  return (
    <div
      className="relative w-full h-full bg-[var(--theme-bg-dark,#070913)] overflow-hidden flex flex-col"
      onClick={() => terminalRef.current?.focus()}
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
      <div ref={containerRef} className="w-full h-full flex-1" />
    </div>
  );
};
