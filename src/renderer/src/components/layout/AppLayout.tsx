import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TerminalTabsHeader } from '../terminal/TerminalTabsHeader';
import { SplitTerminalContainer } from '../terminal/SplitTerminalContainer';
import { SftpExplorer } from '../sftp/SftpExplorer';
import { CodeEditorModal } from '../sftp/CodeEditorModal';
import { PermissionsModal } from '../sftp/PermissionsModal';
import { ProfileManager } from '../profiles/ProfileManager';
import { TunnelDashboard } from '../tunnels/TunnelDashboard';
import { KeyVault } from '../keys/KeyVault';
import { SnippetLibrary } from '../snippets/SnippetLibrary';
import { HostKeyModal } from '../keys/HostKeyModal';
import { SettingsModal } from '../settings/SettingsModal';
import { ShortcutsModal } from '../settings/ShortcutsModal';
import { Toast } from '../common/Toast';
import { useApp } from '../../context/AppContext';
import { useTerminal } from '../../context/TerminalContext';

export const AppLayout: React.FC = () => {
  const {
    activeView,
    editingFile,
    setEditingFile,
    editingPermissionsFile,
    setEditingPermissionsFile,
    hostKeyPrompt,
    resolveHostKeyPrompt,
    toast,
    setIsSidebarCollapsed,
  } = useApp();

  const {
    isSftpDocked,
    toggleSftpDock,
    sftpDockPosition,
    sftpDockWidth,
    setSftpDockWidth,
    addTab,
    closeTab,
    activeTabId,
    tabs,
    setActiveTabId,
    toggleMultiExec,
  } = useTerminal();

  // State to track active dock resizing
  const [isResizingDock, setIsResizingDock] = React.useState<boolean>(false);

  const startDockResize = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    setIsResizingDock(true);
    const startX = e.clientX;
    const startWidth = sftpDockWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = side === 'left' ? startWidth + deltaX : startWidth - deltaX;
      const maxAllowed = Math.min(1000, window.innerWidth - 280);
      setSftpDockWidth(Math.max(240, Math.min(maxAllowed, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingDock(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T: New Session / Open Launcher
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setActiveTabId(null);
      }
      // Ctrl+Shift+E: Toggle Multi-Exec
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleMultiExec();
      }
      // Ctrl+Shift+S: Toggle SFTP
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleSftpDock();
      }
      // Ctrl+B: Toggle Sidebar
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault();
        setIsSidebarCollapsed((prev: boolean) => !prev);
      }
      // Ctrl+W: Close Active Tab
      else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'w' &&
        !e.shiftKey &&
        activeTabId !== null &&
        (e.target as HTMLElement).tagName !== 'INPUT' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
      // Ctrl+1..9 switch tabs
      else if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key >= '1' &&
        e.key <= '9' &&
        (e.target as HTMLElement).tagName !== 'INPUT' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA'
      ) {
        const idx = parseInt(e.key, 10) - 1;
        if (tabs[idx]) {
          e.preventDefault();
          setActiveTabId(tabs[idx].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addTab, closeTab, activeTabId, tabs, setActiveTabId, toggleMultiExec, toggleSftpDock, setIsSidebarCollapsed]);

  // Global window dragover / drop prevention so unhandled file drops do not navigate away
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--theme-bg-dark,#070913)] text-[var(--theme-text,#e2e8f0)] font-sans antialiased">
      {/* Top Header */}
      <Header />

      {/* Center Layout: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Viewport Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Persistent Terminal Container */}
          <div
            className={`flex-1 flex flex-col h-full w-full overflow-hidden ${
              activeView === 'terminals' ? 'flex' : 'hidden'
            }`}
          >
            {/* Tab strip */}
            <TerminalTabsHeader />

            {/* Terminal Viewport with Dockable SFTP */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Left Docked SFTP */}
              {isSftpDocked && sftpDockPosition === 'left' && (
                <>
                  <div
                    style={{ width: `${sftpDockWidth}px` }}
                    className="h-full flex-shrink-0 z-10 flex flex-col overflow-hidden"
                  >
                    <SftpExplorer onClose={toggleSftpDock} />
                  </div>
                  {/* Left Dock Resize Divider Handle */}
                  <div
                    onMouseDown={e => startDockResize(e, 'left')}
                    onDoubleClick={() => setSftpDockWidth(360)}
                    className="w-1.5 hover:w-2 -ml-0.5 z-20 cursor-col-resize bg-[var(--theme-border,#1e2640)] hover:bg-cyan-500/60 active:bg-cyan-400 transition-all group flex items-center justify-center select-none"
                    title="Drag to resize SFTP dock (Double-click to reset)"
                  >
                    <div className="w-0.5 h-7 bg-slate-600 rounded-full group-hover:bg-cyan-300 group-hover:h-12 transition-all" />
                  </div>
                </>
              )}

              {/* Main Split Terminal View */}
              <SplitTerminalContainer />

              {/* Right Docked SFTP */}
              {isSftpDocked && sftpDockPosition === 'right' && (
                <>
                  {/* Right Dock Resize Divider Handle */}
                  <div
                    onMouseDown={e => startDockResize(e, 'right')}
                    onDoubleClick={() => setSftpDockWidth(360)}
                    className="w-1.5 hover:w-2 -mr-0.5 z-20 cursor-col-resize bg-[var(--theme-border,#1e2640)] hover:bg-cyan-500/60 active:bg-cyan-400 transition-all group flex items-center justify-center select-none"
                    title="Drag to resize SFTP dock (Double-click to reset)"
                  >
                    <div className="w-0.5 h-7 bg-slate-600 rounded-full group-hover:bg-cyan-300 group-hover:h-12 transition-all" />
                  </div>
                  <div
                    style={{ width: `${sftpDockWidth}px` }}
                    className="h-full flex-shrink-0 z-10 flex flex-col overflow-hidden"
                  >
                    <SftpExplorer onClose={toggleSftpDock} />
                  </div>
                </>
              )}
            </div>
          </div>

          {activeView === 'profiles' && <ProfileManager />}
          {activeView === 'tunnels' && <TunnelDashboard />}
          {activeView === 'keys' && <KeyVault />}
          {activeView === 'snippets' && <SnippetLibrary />}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Global Modals & Notifications */}
      <HostKeyModal
        isOpen={!!hostKeyPrompt}
        data={hostKeyPrompt}
        onAccept={(save) => resolveHostKeyPrompt(true, save)}
        onReject={() => resolveHostKeyPrompt(false, false)}
      />
      <CodeEditorModal file={editingFile} onClose={() => setEditingFile(null)} />
      <PermissionsModal
        file={editingPermissionsFile}
        onClose={() => setEditingPermissionsFile(null)}
      />
      <SettingsModal />
      <ShortcutsModal />
      {/* Fullscreen overlay during active dock resizing */}
      {isResizingDock && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" style={{ pointerEvents: 'auto' }} />
      )}
      <Toast toast={toast} />
    </div>
  );
};
