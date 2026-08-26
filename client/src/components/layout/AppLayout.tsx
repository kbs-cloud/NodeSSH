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
import { AuthModal } from '../auth/AuthModal';
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
    isAuthModalOpen,
    setIsAuthModalOpen,
    hostKeyPrompt,
    resolveHostKeyPrompt,
    toast,
    setIsSidebarCollapsed,
  } = useApp();

  const {
    isSftpDocked,
    toggleSftpDock,
    sftpDockPosition,
    addTab,
    closeTab,
    activeTabId,
    tabs,
    setActiveTabId,
    toggleMultiExec,
  } = useTerminal();

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
                <div className="w-80 h-full flex-shrink-0 z-10">
                  <SftpExplorer onClose={toggleSftpDock} />
                </div>
              )}

              {/* Main Split Terminal View */}
              <SplitTerminalContainer />

              {/* Right Docked SFTP */}
              {isSftpDocked && sftpDockPosition === 'right' && (
                <div className="w-80 h-full flex-shrink-0 z-10">
                  <SftpExplorer onClose={toggleSftpDock} />
                </div>
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
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <SettingsModal />
      <ShortcutsModal />
      <Toast toast={toast} />
    </div>
  );
};
