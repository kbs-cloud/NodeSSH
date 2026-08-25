import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Settings, Check, Palette, Terminal, FolderTree, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { AppTheme } from '../../types';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, settings, updateSettings, lanIp } = useApp();
  const { theme, setTheme, availableThemes } = useTheme();

  const [fontSize, setFontSize] = useState<number>(settings.fontSize || 14);
  const [fontFamily, setFontFamily] = useState<string>(settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace");
  const [cursorStyle, setCursorStyle] = useState<'block' | 'underline' | 'bar'>(settings.cursorStyle || 'block');
  const [cursorBlink, setCursorBlink] = useState<boolean>(settings.cursorBlink ?? true);
  const [terminalSound, setTerminalSound] = useState<boolean>(settings.terminalSound ?? false);
  const [sftpPosition, setSftpPosition] = useState<'left' | 'right' | 'sidebar'>(settings.sftpPosition || 'right');
  const [defaultCloseOnExit, setDefaultCloseOnExit] = useState<boolean>(settings.defaultCloseOnExit ?? true);
  const [defaultKeepalive, setDefaultKeepalive] = useState<number>(settings.defaultKeepalive || 30);

  useEffect(() => {
    if (isSettingsOpen) {
      setFontSize(settings.fontSize || 14);
      setFontFamily(settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace");
      setCursorStyle(settings.cursorStyle || 'block');
      setCursorBlink(settings.cursorBlink ?? true);
      setTerminalSound(settings.terminalSound ?? false);
      setSftpPosition(settings.sftpPosition || 'right');
      setDefaultCloseOnExit(settings.defaultCloseOnExit ?? true);
      setDefaultKeepalive(settings.defaultKeepalive || 30);
    }
  }, [settings, isSettingsOpen]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      theme,
      fontSize,
      fontFamily,
      cursorStyle,
      cursorBlink,
      terminalSound,
      sftpPosition,
      defaultCloseOnExit,
      defaultKeepalive,
    });
    setIsSettingsOpen(false);
  };

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title="Preferences & Terminal Settings"
      subtitle="Customize themes, xterm fonts, SFTP layout, and SSH defaults"
      icon={<Settings className="w-5 h-5" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSave} className="space-y-5 text-xs text-slate-200">
        {/* Themes Grid */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>UI & Terminal Color Theme</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {availableThemes.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id as AppTheme)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-2 ${
                  theme === t.id
                    ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-lg bg-[#0e1222]'
                    : 'bg-[#070913] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{t.name}</span>
                  {theme === t.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span
                    className="w-4 h-4 rounded-full border border-black/40"
                    style={{ backgroundColor: t.primary }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-black/40"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-black/40"
                    style={{ backgroundColor: t.bgDark }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Configuration */}
        <div className="p-3.5 bg-[#0e1222] border border-white/5 rounded-xl space-y-3">
          <label className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Terminal Appearance & Addons</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Font Size (px)</label>
              <input
                type="number"
                min={10}
                max={28}
                value={fontSize}
                onChange={e => setFontSize(parseInt(e.target.value, 10) || 14)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Cursor Style</label>
              <select
                value={cursorStyle}
                onChange={e => setCursorStyle(e.target.value as any)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none font-mono"
              >
                <option value="block">Block █</option>
                <option value="underline">Underline  </option>
                <option value="bar">Bar |</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Cursor Blink</label>
              <select
                value={cursorBlink ? 'yes' : 'no'}
                onChange={e => setCursorBlink(e.target.value === 'yes')}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none font-mono"
              >
                <option value="yes">Enabled</option>
                <option value="no">Solid (Disabled)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] mb-1">Font Family</label>
            <input
              type="text"
              value={fontFamily}
              onChange={e => setFontFamily(e.target.value)}
              className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none font-mono"
            />
          </div>
        </div>

        {/* SFTP & General defaults */}
        <div className="p-3.5 bg-[#0e1222] border border-white/5 rounded-xl space-y-3">
          <label className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <FolderTree className="w-4 h-4 text-emerald-400" />
            <span>SFTP Explorer & Session Management</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">SFTP Panel Position</label>
              <select
                value={sftpPosition}
                onChange={e => setSftpPosition(e.target.value as any)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none font-mono"
              >
                <option value="right">Docked on Right Side</option>
                <option value="left">Docked on Left Side</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">SSH Keepalive (Seconds)</label>
              <input
                type="number"
                value={defaultKeepalive}
                onChange={e => setDefaultKeepalive(parseInt(e.target.value, 10) || 30)}
                className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none font-mono"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={defaultCloseOnExit}
              onChange={e => setDefaultCloseOnExit(e.target.checked)}
              className="accent-cyan-400 w-4 h-4"
            />
            <span className="text-slate-300">
              Always kill remote SSH background process when closing tab
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-bold shadow-lg transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
