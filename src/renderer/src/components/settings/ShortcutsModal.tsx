import React from 'react';
import { Modal } from '../common/Modal';
import { Command, Keyboard } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsOpen, setIsShortcutsOpen } = useApp();

  const shortcuts = [
    { key: 'Ctrl + Shift + T', desc: 'Create New Terminal Tab' },
    { key: 'Ctrl + W', desc: 'Close Active Terminal Tab (Kill Session)' },
    { key: 'Ctrl + Shift + E', desc: 'Toggle Multi-Exec / Broadcast Input Mode' },
    { key: 'Ctrl + Shift + S', desc: 'Toggle Dockable SFTP File Explorer' },
    { key: 'Ctrl + F', desc: 'Search / Find in Terminal Output' },
    { key: 'Ctrl + Shift + D', desc: 'Duplicate Active Session' },
    { key: 'Ctrl + 1 .. 9', desc: 'Switch Directly to Tab 1 through 9' },
    { key: 'Ctrl + B', desc: 'Toggle Collapsible Sidebar' },
    { key: 'Ctrl + L', desc: 'Clear Terminal Screen' },
    { key: 'Ctrl + C', desc: 'Send SIGINT (Interrupt Signal)' },
  ];

  return (
    <Modal
      isOpen={isShortcutsOpen}
      onClose={() => setIsShortcutsOpen(false)}
      title="Keyboard Shortcuts Cheatsheet"
      subtitle="Supercharge your productivity with rapid terminal hotkeys"
      icon={<Keyboard className="w-5 h-5" />}
      maxWidth="md"
    >
      <div className="space-y-3 text-xs text-slate-200">
        <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden bg-[#070913]">
          {shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 hover:bg-white/5">
              <span className="text-slate-300">{sc.desc}</span>
              <kbd className="px-2 py-1 rounded bg-[#151b30] border border-white/10 text-cyan-400 font-mono text-[11px] shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => setIsShortcutsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
};
