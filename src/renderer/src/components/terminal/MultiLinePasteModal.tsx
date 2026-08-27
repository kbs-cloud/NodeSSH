import React from 'react';
import { Modal } from '../common/Modal';
import { AlertTriangle, ClipboardPaste, X } from 'lucide-react';

interface MultiLinePasteModalProps {
  isOpen: boolean;
  text: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const MultiLinePasteModal: React.FC<MultiLinePasteModalProps> = ({
  isOpen,
  text,
  onConfirm,
  onClose,
}) => {
  const lines = text.split(/\r\n|\r|\n/);
  const lineCount = lines.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Multi-Line Paste"
      subtitle={`The clipboard contains ${lineCount} lines of text`}
      icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
      maxWidth="xl"
      actions={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 text-xs font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Paste {lineCount} Lines</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-200">
        {/* Warning Banner */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              Warning: Multi-line text will execute automatically!
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Pasting text that contains newline characters will immediately send Return/Enter keys
              to the shell, executing each command in sequence without further prompting.
            </p>
          </div>
        </div>

        {/* Code Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Content to paste:</span>
            <span className="font-mono text-cyan-400">{lineCount} lines, {text.length} characters</span>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-[var(--theme-border,#1e2640)] bg-[#070913] p-3 font-mono text-[11px] leading-relaxed">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="pr-3 text-right text-slate-600 select-none w-8 align-top">
                      {idx + 1}
                    </td>
                    <td className="text-slate-200 whitespace-pre-wrap break-all font-mono">
                      {line === '' ? <span className="text-slate-600 italic">(empty line)</span> : line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
