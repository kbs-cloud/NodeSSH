import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X, CaseSensitive, WholeWord, Regex } from 'lucide-react';
import { SearchAddon } from '@xterm/addon-search';

interface TerminalSearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({ searchAddon, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!searchAddon) return;
    if (searchTerm) {
      searchAddon.findNext(searchTerm, {
        caseSensitive,
        wholeWord,
        regex,
        incremental: true,
      });
    }
  }, [searchTerm, caseSensitive, wholeWord, regex, searchAddon]);

  const handleNext = () => {
    if (searchAddon && searchTerm) {
      searchAddon.findNext(searchTerm, { caseSensitive, wholeWord, regex });
    }
  };

  const handlePrev = () => {
    if (searchAddon && searchTerm) {
      searchAddon.findPrevious(searchTerm, { caseSensitive, wholeWord, regex });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-4 z-30 flex items-center gap-1.5 p-1.5 bg-[#0e1222]/95 border border-[#1e2640] rounded-lg shadow-xl backdrop-blur text-xs">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-white/10 rounded">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Find in terminal..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none outline-none text-slate-100 placeholder-slate-500 w-44 text-xs font-mono"
        />
      </div>

      <button
        onClick={() => setCaseSensitive(!caseSensitive)}
        className={`p-1 rounded transition-colors ${
          caseSensitive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
        }`}
        title="Match Case"
      >
        <CaseSensitive className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => setWholeWord(!wholeWord)}
        className={`p-1 rounded transition-colors ${
          wholeWord ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
        }`}
        title="Match Whole Word"
      >
        <WholeWord className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => setRegex(!regex)}
        className={`p-1 rounded transition-colors ${
          regex ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
        }`}
        title="Use Regular Expression"
      >
        <Regex className="w-3.5 h-3.5" />
      </button>

      <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

      <button
        onClick={handlePrev}
        className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded"
        title="Previous Match (Shift+Enter)"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={handleNext}
        className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded"
        title="Next Match (Enter)"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded ml-1"
        title="Close Search (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
