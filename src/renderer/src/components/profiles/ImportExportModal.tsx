import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Download, Upload, FileText, Check, Copy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseMobaXtermSessions, exportToMobaXtermSessions, exportToNodeSSHJson } from '../../utils/mobaxtermParser';
import { ServerProfile } from '../../types';

export const ImportExportModal: React.FC = () => {
  const {
    isImportExportOpen,
    setIsImportExportOpen,
    profiles,
    importProfiles,
    snippets,
    tunnels,
    settings,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importText, setImportText] = useState('');
  const [parsedProfiles, setParsedProfiles] = useState<Partial<ServerProfile>[]>([]);

  const handleTextChange = (text: string) => {
    setImportText(text);
    if (!text.trim()) {
      setParsedProfiles([]);
      return;
    }

    try {
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        const json = JSON.parse(text);
        const list = Array.isArray(json) ? json : json.profiles || [];
        setParsedProfiles(list);
      } else {
        const list = parseMobaXtermSessions(text);
        setParsedProfiles(list);
      }
    } catch {
      setParsedProfiles([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedProfiles.length === 0) return;
    await importProfiles(parsedProfiles);
    setIsImportExportOpen(false);
    setImportText('');
    setParsedProfiles([]);
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  };

  const exportMobaXterm = () => {
    const content = exportToMobaXtermSessions(profiles);
    downloadFile('nodessh_sessions.mxtsessions', content, 'text/plain;charset=utf-8');
  };

  const exportNodeSSH = () => {
    const content = exportToNodeSSHJson({
      profiles,
      snippets,
      tunnels,
      settings,
    });
    downloadFile('nodessh_backup_2026.json', content, 'application/json;charset=utf-8');
  };

  return (
    <Modal
      isOpen={isImportExportOpen}
      onClose={() => setIsImportExportOpen(false)}
      title="Import / Export Sessions & Profiles"
      subtitle="Full support for MobaXterm (.mxtsessions / .ini) and NodeSSH JSON backups"
      icon={<Upload className="w-5 h-5" />}
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs text-slate-200">
        {/* Subtabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-[var(--theme-primary,#00f0ff)] text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Profiles</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-[var(--theme-primary,#00f0ff)] text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Profiles</span>
          </button>
        </div>

        {activeTab === 'import' ? (
          <div className="space-y-4">
            {/* File Upload Zone */}
            <div className="p-4 rounded-lg border-2 border-dashed border-white/10 hover:border-cyan-400/50 bg-[#070913] text-center transition-colors">
              <input
                type="file"
                id="session-import-file"
                accept=".mxtsessions,.ini,.json,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="session-import-file"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <FileText className="w-8 h-8 text-cyan-400" />
                <span className="font-semibold text-white">Click or drop .mxtsessions / .ini / .json file here</span>
                <span className="text-slate-500 text-[11px]">Supports MobaXterm bookmarks and NodeSSH backups</span>
              </label>
            </div>

            {/* Raw Text Paste */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Or Paste Session Text / INI Content</label>
              <textarea
                rows={5}
                value={importText}
                onChange={e => handleTextChange(e.target.value)}
                placeholder="[Bookmarks]&#10;SubRep=Production&#10;Server1=#109#0%192.168.1.150%22%ubuntu%..."
                className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg p-3 text-slate-200 font-mono text-xs outline-none focus:border-cyan-400"
              />
            </div>

            {/* Parsed Preview */}
            {parsedProfiles.length > 0 && (
              <div className="p-3 bg-[#0e1222] border border-cyan-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300">
                    Found {parsedProfiles.length} Profiles Ready to Import:
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-white/5 font-mono text-[11px]">
                  {parsedProfiles.map((p, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between">
                      <span className="text-white font-medium">{p.name}</span>
                      <span className="text-slate-400">
                        {p.username}@{p.host}:{p.port || 22} ({p.folder || 'Default'})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import Button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsImportExportOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={parsedProfiles.length === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-semibold shadow-md transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Import {parsedProfiles.length} Profiles</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-slate-300 text-xs leading-relaxed">
              Export your configured profiles, groups, and settings for backup or for use in other desktop clients like MobaXterm.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* MobaXterm .mxtsessions */}
              <div className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] flex flex-col justify-between gap-4">
                <div>
                  <h4 className="font-bold text-white text-sm">MobaXterm Sessions (.mxtsessions)</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Exports {profiles.length} profiles organized into folders compatible with MobaXterm desktop app.
                  </p>
                </div>
                <button
                  onClick={exportMobaXterm}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .mxtsessions</span>
                </button>
              </div>

              {/* NodeSSH JSON Backup */}
              <div className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] flex flex-col justify-between gap-4">
                <div>
                  <h4 className="font-bold text-white text-sm">Full NodeSSH JSON Backup</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Exports profiles, tunnels, snippets, and app settings into a unified JSON restore backup.
                  </p>
                </div>
                <button
                  onClick={exportNodeSSH}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-semibold text-xs shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download JSON Backup</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
