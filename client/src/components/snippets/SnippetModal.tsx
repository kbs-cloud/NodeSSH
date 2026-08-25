import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Terminal, Check, Sparkles } from 'lucide-react';
import { Snippet } from '../../types';
import { useApp } from '../../context/AppContext';

export const SnippetModal: React.FC = () => {
  const {
    isSnippetModalOpen,
    setIsSnippetModalOpen,
    editingSnippet,
    setEditingSnippet,
    saveSnippet,
  } = useApp();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('SysAdmin');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [tagsString, setTagsString] = useState('');
  const [autoExecute, setAutoExecute] = useState(true);

  useEffect(() => {
    if (editingSnippet) {
      setName(editingSnippet.name);
      setCategory(editingSnippet.category || 'SysAdmin');
      setCommand(editingSnippet.command);
      setDescription(editingSnippet.description || '');
      setTagsString(editingSnippet.tags.join(', '));
      setAutoExecute(editingSnippet.autoExecute ?? true);
    } else {
      setName('');
      setCategory('SysAdmin');
      setCommand('');
      setDescription('');
      setTagsString('Command, Script');
      setAutoExecute(true);
    }
  }, [editingSnippet, isSnippetModalOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsString.split(',').map(t => t.trim()).filter(Boolean);

    const snippetData: Snippet = {
      id: editingSnippet ? editingSnippet.id : 'snip-' + Date.now(),
      name: name.trim() || 'Command Snippet',
      category: category.trim() || 'Custom',
      command: command.trim(),
      description: description.trim() || undefined,
      tags,
      autoExecute,
      createdAt: editingSnippet ? editingSnippet.createdAt : new Date().toISOString(),
    };

    await saveSnippet(snippetData);
    setIsSnippetModalOpen(false);
    setEditingSnippet(null);
  };

  const categories = ['SysAdmin', 'Docker', 'Network', 'Web', 'Logs', 'Database', 'Git', 'Custom'];

  return (
    <Modal
      isOpen={isSnippetModalOpen}
      onClose={() => {
        setIsSnippetModalOpen(false);
        setEditingSnippet(null);
      }}
      title={editingSnippet ? 'Edit Snippet / Macro' : 'New Command Snippet'}
      subtitle="Save frequently used scripts and commands for instant 1-click execution"
      icon={<Terminal className="w-5 h-5" />}
      maxWidth="xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs text-slate-200">
        {/* Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Snippet Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Restart Nginx & Test Config"
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Command Script */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Command / Script</label>
          <textarea
            required
            rows={4}
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="echo '=== HEALTH ===' && df -h && docker ps"
            className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg p-3 text-cyan-300 font-mono text-xs outline-none focus:border-cyan-400"
          />
        </div>

        {/* Description & Tags */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Description (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Briefly describe what this snippet does..."
            className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsString}
              onChange={e => setTagsString(e.target.value)}
              placeholder="Docker, Health, Disk"
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>

          <div className="pt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={e => setAutoExecute(e.target.checked)}
                className="accent-cyan-400 w-4 h-4"
              />
              <span className="text-slate-300">Auto-execute on click (Appends Enter)</span>
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              setIsSnippetModalOpen(false);
              setEditingSnippet(null);
            }}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-semibold text-xs shadow-lg transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{editingSnippet ? 'Save Changes' : 'Create Snippet'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
