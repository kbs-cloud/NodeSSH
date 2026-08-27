import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Play,
  Copy,
  Radio,
  Edit,
  Trash2,
  Tag,
  Folder,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTerminal } from '../../context/TerminalContext';
import { Snippet } from '../../types';
import { SnippetModal } from './SnippetModal';

export const SnippetLibrary: React.FC = () => {
  const {
    snippets,
    setIsSnippetModalOpen,
    setEditingSnippet,
    deleteSnippet,
    setActiveView,
    showToast,
  } = useApp();

  const { sendInputToActiveTab, broadcastCommand } = useTerminal();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(snippets.map(s => s.category || 'General')));

  const handleExecute = (snippet: Snippet) => {
    sendInputToActiveTab(snippet.command + (snippet.autoExecute ? '\r' : ''));
    setActiveView('terminals');
    showToast(`Executed snippet: "${snippet.name}"`, 'success');
  };

  const handleBroadcast = (snippet: Snippet) => {
    broadcastCommand(snippet.command);
    setActiveView('terminals');
    showToast(`Broadcasted snippet "${snippet.name}" to all open tabs`, 'success');
  };

  const handleCopy = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.command);
    showToast(`Copied snippet to clipboard`, 'info');
  };

  const filteredSnippets = snippets.filter(s => {
    if (selectedCategory && s.category !== selectedCategory) return false;
    if (
      search &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.command.toLowerCase().includes(search.toLowerCase()) &&
      !s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex-1 h-full overflow-y-auto p-5 bg-[var(--theme-bg-dark,#070913)] space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Snippets & Macro Library
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Store commands and batch scripts for 1-click execution or Multi-Exec broadcast
          </p>
        </div>

        <button
          onClick={() => {
            setEditingSnippet(null);
            setIsSnippetModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-bold text-xs shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Snippet</span>
        </button>
      </div>

      {/* Search & Categories */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search snippets by name, command, or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-slate-500 w-full font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg p-1 text-xs">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded transition-colors ${
              selectedCategory === null ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Categories ({snippets.length})
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1 rounded transition-colors ${
                selectedCategory === c ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Snippet Cards Grid */}
      {filteredSnippets.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/20 text-slate-500 text-xs">
          No snippets match your filter. Click &quot;New Snippet&quot; to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSnippets.map(snip => (
            <div
              key={snip.id}
              className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/40 shadow-lg flex flex-col justify-between gap-3 group transition-all"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{snip.name}</h3>
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-cyan-400 font-mono text-[10px]">
                      {snip.category}
                    </span>
                  </div>
                  {snip.description && (
                    <p className="text-xs text-slate-400 mt-1">{snip.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingSnippet(snip);
                      setIsSnippetModalOpen(true);
                    }}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10"
                    title="Edit Snippet"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete snippet "${snip.name}"?`)) {
                        deleteSnippet(snip.id);
                      }
                    }}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Delete Snippet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Code Box */}
              <div className="p-2.5 bg-black/50 rounded-lg border border-white/5 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                {snip.command}
              </div>

              {/* Tags */}
              {snip.tags && snip.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {snip.tags.map(t => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400 text-[10px]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                <button
                  onClick={() => handleCopy(snip)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBroadcast(snip)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 font-medium transition-colors border border-rose-500/30"
                    title="Broadcast snippet to all open terminals"
                  >
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    <span>Broadcast</span>
                  </button>

                  <button
                    onClick={() => handleExecute(snip)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-semibold shadow-sm transition-all"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Execute</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snippet Modal */}
      <SnippetModal />
    </div>
  );
};
