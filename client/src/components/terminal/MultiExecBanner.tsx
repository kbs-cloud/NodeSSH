import React, { useState } from 'react';
import { Radio, Send, X, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';

export const MultiExecBanner: React.FC = () => {
  const { tabs, isMultiExecActive, setIsMultiExecActive, broadcastCommand } = useTerminal();
  const { snippets } = useApp();
  const [broadcastText, setBroadcastText] = useState('');
  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);

  if (!isMultiExecActive) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (broadcastText.trim()) {
      broadcastCommand(broadcastText.trim());
      setBroadcastText('');
    }
  };

  const handleSnippetExecute = (cmd: string) => {
    broadcastCommand(cmd);
    setIsSnippetsOpen(false);
  };

  return (
    <div className="bg-rose-950/90 border-b border-rose-600/60 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-rose-200 animate-broadcast shadow-lg z-20">
      {/* Left indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
        <Radio className="w-4 h-4 text-rose-400 animate-ping" />
        <span className="text-white font-bold uppercase tracking-wider">
          Multi-Exec Active
        </span>
        <span className="text-rose-300 hidden sm:inline">
          — Keystrokes & commands broadcast to all {tabs.length} sessions
        </span>
      </div>

      {/* Center quick command input */}
      <form onSubmit={handleSend} className="flex-1 max-w-lg flex items-center gap-2">
        <div className="relative flex-1">
          <TerminalIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-rose-400" />
          <input
            type="text"
            placeholder="Type command to broadcast immediately to all tabs (Enter)..."
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            className="w-full bg-black/60 border border-rose-500/50 rounded-md pl-8 pr-3 py-1 text-xs font-mono text-white placeholder-rose-400/60 outline-none focus:border-rose-400"
          />
        </div>
        <button
          type="submit"
          disabled={!broadcastText.trim()}
          className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
        >
          <Send className="w-3 h-3" />
          <span>Broadcast</span>
        </button>

        {/* Snippet Picker for broadcast */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSnippetsOpen(!isSnippetsOpen)}
            className="flex items-center gap-1 px-2.5 py-1 bg-black/40 hover:bg-black/60 border border-rose-500/40 rounded text-xs text-rose-200 transition-colors"
            title="Broadcast Snippet"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">Snippet</span>
          </button>

          {isSnippetsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsSnippetsOpen(false)} />
              <div className="absolute right-0 top-8 z-50 w-72 p-1.5 bg-[#151b30] border border-rose-500/40 rounded-lg shadow-2xl text-xs text-slate-200">
                <div className="px-2 py-1 font-semibold text-rose-400 text-[11px] uppercase tracking-wider">
                  Broadcast Snippet to All Tabs
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 mt-1">
                  {snippets.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSnippetExecute(s.command)}
                      className="w-full text-left p-2 rounded hover:bg-white/10 flex flex-col gap-0.5"
                    >
                      <span className="font-medium text-white truncate">{s.name}</span>
                      <code className="text-[10px] text-slate-400 font-mono truncate">
                        {s.command}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </form>

      {/* Right dismiss button */}
      <button
        onClick={() => setIsMultiExecActive(false)}
        className="p-1 rounded text-rose-400 hover:text-white hover:bg-rose-800/40 transition-colors"
        title="Exit Multi-Exec Mode"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
