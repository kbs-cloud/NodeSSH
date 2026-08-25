import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Shield, Check } from 'lucide-react';
import { SFTPFileItem } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface PermissionsModalProps {
  file: SFTPFileItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ file, onClose, onSuccess }) => {
  const { showToast } = useApp();

  // Permissions state
  const [ownerRead, setOwnerRead] = useState(true);
  const [ownerWrite, setOwnerWrite] = useState(true);
  const [ownerExec, setOwnerExec] = useState(true);

  const [groupRead, setGroupRead] = useState(true);
  const [groupWrite, setGroupWrite] = useState(false);
  const [groupExec, setGroupExec] = useState(true);

  const [othersRead, setOthersRead] = useState(true);
  const [othersWrite, setOthersWrite] = useState(false);
  const [othersExec, setOthersExec] = useState(true);

  const [isRecursive, setIsRecursive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!file) return;
    const perm = file.permissions || '0755';
    // If octal digits e.g. 0755 or 755
    const digits = perm.replace(/[^0-9]/g, '').slice(-3);
    if (digits.length === 3) {
      const o = parseInt(digits[0], 10);
      const g = parseInt(digits[1], 10);
      const ot = parseInt(digits[2], 10);

      setOwnerRead(Boolean(o & 4));
      setOwnerWrite(Boolean(o & 2));
      setOwnerExec(Boolean(o & 1));

      setGroupRead(Boolean(g & 4));
      setGroupWrite(Boolean(g & 2));
      setGroupExec(Boolean(g & 1));

      setOthersRead(Boolean(ot & 4));
      setOthersWrite(Boolean(ot & 2));
      setOthersExec(Boolean(ot & 1));
    }
  }, [file]);

  if (!file) return null;

  const ownerVal = (ownerRead ? 4 : 0) + (ownerWrite ? 2 : 0) + (ownerExec ? 1 : 0);
  const groupVal = (groupRead ? 4 : 0) + (groupWrite ? 2 : 0) + (groupExec ? 1 : 0);
  const othersVal = (othersRead ? 4 : 0) + (othersWrite ? 2 : 0) + (othersExec ? 1 : 0);
  const octalString = `0${ownerVal}${groupVal}${othersVal}`;

  const handleApply = async () => {
    setIsSaving(true);
    try {
      await api.chmodSftpFile(file.path, octalString);
      showToast(`Permissions updated to ${octalString} for ${file.name}`, 'success');
      onSuccess?.();
      onClose();
    } catch {
      showToast(`Failed to update permissions for ${file.name}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!file}
      onClose={onClose}
      title="File Permissions (chmod)"
      subtitle={`Target: ${file.path}`}
      icon={<Shield className="w-5 h-5" />}
      maxWidth="md"
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-400 font-mono">
            Octal Mode: <span className="text-cyan-400 font-bold">{octalString}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-semibold text-xs transition-all shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Applying...' : 'Apply Permissions'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs text-slate-200">
        {/* Permission Grid */}
        <div className="border border-[var(--theme-border,#1e2640)] rounded-lg overflow-hidden bg-black/30">
          <div className="grid grid-cols-4 bg-[#0e1222] p-2.5 font-semibold text-slate-300 border-b border-[var(--theme-border,#1e2640)]">
            <span>Role</span>
            <span className="text-center">Read (r)</span>
            <span className="text-center">Write (w)</span>
            <span className="text-center">Execute (x)</span>
          </div>

          {/* Owner */}
          <div className="grid grid-cols-4 p-2.5 items-center border-b border-white/5 hover:bg-white/5">
            <span className="font-medium text-cyan-400">Owner (User)</span>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={ownerRead}
                onChange={e => setOwnerRead(e.target.checked)}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={ownerWrite}
                onChange={e => setOwnerWrite(e.target.checked)}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={ownerExec}
                onChange={e => setOwnerExec(e.target.checked)}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Group */}
          <div className="grid grid-cols-4 p-2.5 items-center border-b border-white/5 hover:bg-white/5">
            <span className="font-medium text-purple-400">Group</span>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={groupRead}
                onChange={e => setGroupRead(e.target.checked)}
                className="accent-purple-400 w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={groupWrite}
                onChange={e => setGroupWrite(e.target.checked)}
                className="accent-purple-400 w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={groupExec}
                onChange={e => setGroupExec(e.target.checked)}
                className="accent-purple-400 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Others */}
          <div className="grid grid-cols-4 p-2.5 items-center hover:bg-white/5">
            <span className="font-medium text-emerald-400">Others</span>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={othersRead}
                onChange={e => setOthersRead(e.target.checked)}
                className="accent-emerald-400 w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={othersWrite}
                onChange={e => setOthersWrite(e.target.checked)}
                className="accent-emerald-400 w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={othersExec}
                onChange={e => setOthersExec(e.target.checked)}
                className="accent-emerald-400 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Recursive Option */}
        {file.type === 'directory' && (
          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-white/10 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecursive}
              onChange={e => setIsRecursive(e.target.checked)}
              className="accent-cyan-400 w-4 h-4"
            />
            <span className="text-slate-300">Apply permissions recursively to all subdirectories and files</span>
          </label>
        )}
      </div>
    </Modal>
  );
};
