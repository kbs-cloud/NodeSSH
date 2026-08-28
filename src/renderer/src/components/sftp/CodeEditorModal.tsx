import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { FileCode, Save, Search, WrapText, Check, AlertCircle } from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useTerminal } from '../../context/TerminalContext';

interface CodeEditorModalProps {
  file: SFTPFileItem | null;
  onClose: () => void;
}

export const CodeEditorModal: React.FC<CodeEditorModalProps> = ({ file, onClose }) => {
  const { showToast, profiles } = useApp();
  const { activeTab } = useTerminal();

  const activeProfile =
    activeTab?.profile ||
    (activeTab?.profileId ? profiles.find(p => p.id === activeTab.profileId) : undefined) ||
    (profiles.length > 0 ? profiles[0] : undefined);

  const [content, setContent] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  const isDirty = content !== initialContent;
  const isLocalFile = (file as any)?.isLocal || file?.owner === 'local';
  const effectiveProfile = (file as any)?.profileTarget || activeProfile;

  useEffect(() => {
    if (!file) return;
    setIsLoading(true);
    const readPromise = isLocalFile
      ? api.readLocalFile(file.path)
      : api.readSftpFile(file.path, effectiveProfile);

    readPromise
      .then(data => {
        setContent(data);
        setInitialContent(data);
        setIsLoading(false);
      })
      .catch((err: any) => {
        setContent(`# Error loading file: ${err.message || 'File read error'}`);
        setIsLoading(false);
      });
  }, [file, effectiveProfile, isLocalFile]);

  const handleSave = async () => {
    if (!file) return;
    setIsSaving(true);
    try {
      if (isLocalFile) {
        await api.writeLocalFile(file.path, content);
        setInitialContent(content);
        showToast(`Saved ${file.name} locally`, 'success');
      } else {
        await api.writeSftpFile(file.path, content, effectiveProfile);
        setInitialContent(content);
        showToast(`Saved ${file.name} to server`, 'success');
      }
    } catch (err: any) {
      showToast(`Failed to save ${file.name}: ${err.message || 'Write error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!file) return null;

  const lines = content.split('\n');

  return (
    <Modal
      isOpen={!!file}
      onClose={() => {
        if (isDirty) {
          if (window.confirm('You have unsaved changes. Discard and close?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }}
      title={`Editor — ${file.name}`}
      subtitle={`Remote Path: ${file.path}`}
      icon={<FileCode className="w-5 h-5" />}
      maxWidth="6xl"
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{lines.length} lines</span>
            <span>{content.length} characters</span>
            {isDirty ? (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Unsaved Changes
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                All changes saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-semibold text-xs transition-all shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save File (SFTP)'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[65vh] border border-[var(--theme-border,#1e2640)] rounded-lg overflow-hidden bg-[#070913]">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0e1222] border-b border-[var(--theme-border,#1e2640)] text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-cyan-400 font-semibold">{file.name}</span>
            <span className="text-slate-500 font-mono text-[11px]">{file.permissions}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded transition-colors ${
                showSearch ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Search in file"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 rounded transition-colors ${
                wordWrap ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Word Wrap"
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Bar in Editor */}
        {showSearch && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151b30] border-b border-white/10 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search in file..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs text-white outline-none"
            />
          </div>
        )}

        {/* Code Content Area with Line Numbers */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Loading remote file content over SFTP...
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Line numbers gutter */}
            <div className="w-12 bg-[#090b14] border-r border-white/5 py-3 select-none text-right pr-3 text-[11px] font-mono text-slate-600 overflow-hidden">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              className={`flex-1 p-3 bg-transparent text-slate-100 font-mono text-xs leading-6 outline-none resize-none overflow-auto select-text ${
                wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'
              }`}
              style={{
                tabSize: 2,
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
