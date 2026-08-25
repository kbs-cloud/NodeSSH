import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  Radio,
  FolderTree,
  Palette,
  Sparkles,
  Keyboard,
  Settings,
  Shield,
  User,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { QuickConnectBar } from '../profiles/QuickConnectBar';
import { AppTheme } from '../../types';

export const Header: React.FC = () => {
  const { theme, setTheme, availableThemes } = useTheme();
  const {
    isMultiExecActive,
    toggleMultiExec,
    isSftpDocked,
    toggleSftpDock,
    tabs,
  } = useTerminal();

  const {
    snippets,
    setIsSettingsOpen,
    setIsShortcutsOpen,
    setIsAuthModalOpen,
    setActiveView,
  } = useApp();

  const { user, isAuthenticated } = useAuth();

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);

  return (
    <header className="h-12 bg-[var(--theme-bg-dark,#070913)] border-b border-[var(--theme-border,#1e2640)] px-3 flex items-center justify-between gap-3 select-none z-30">
      {/* Left: Brand Logo */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setActiveView('terminals')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <div className="p-1.5 rounded-lg bg-[var(--theme-primary,#00f0ff)]/15 border border-[var(--theme-primary,#00f0ff)]/40 text-[var(--theme-primary,#00f0ff)] shadow-sm">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-base tracking-wider text-white font-mono">
              Node<span className="text-[var(--theme-primary,#00f0ff)]">SSH</span>
            </span>
            <span className="hidden sm:inline px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-slate-300">
              v1.0
            </span>
          </div>
        </button>
      </div>

      {/* Center: Quick Connect Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-xl justify-center px-4">
        <QuickConnectBar />
      </div>

      {/* Right Toolbar Controls */}
      <div className="flex items-center gap-1.5">
        {/* Multi-Exec Broadcast Toggle */}
        <button
          onClick={toggleMultiExec}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isMultiExecActive
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Toggle Multi-Exec / Broadcast to all terminal tabs (Ctrl+Shift+E)"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Multi-Exec</span>
        </button>

        {/* SFTP Drawer Button */}
        <button
          onClick={toggleSftpDock}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
            isSftpDocked
              ? 'bg-[var(--theme-primary,#00f0ff)]/20 text-[var(--theme-primary,#00f0ff)] border border-[var(--theme-primary,#00f0ff)]/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle SFTP Side Explorer (Ctrl+Shift+S)"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden md:inline">SFTP</span>
        </button>

        {/* Theme Picker Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Switch Theme"
          >
            <Palette className="w-4 h-4" />
          </button>

          {isThemeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsThemeOpen(false)} />
              <div className="absolute right-0 top-10 z-50 w-48 p-1 bg-[#151b30] border border-[var(--theme-border,#1e2640)] rounded-xl shadow-2xl text-xs">
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Select Theme
                </div>
                {availableThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id as AppTheme);
                      setIsThemeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                      theme === t.id ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-black/40"
                        style={{ backgroundColor: t.primary }}
                      />
                      <span>{t.name}</span>
                    </div>
                    {theme === t.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Keyboard Shortcuts */}
        <button
          onClick={() => setIsShortcutsOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Keyboard Shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Preferences */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Preferences & Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Account / Auth Avatar Pill */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg bg-[#0e1222] hover:bg-[#151b30] border border-white/10 transition-colors text-xs ml-1"
        >
          <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <span className="text-slate-200 font-medium hidden sm:inline">
            {user?.username || 'Sign In'}
          </span>
        </button>
      </div>
    </header>
  );
};
