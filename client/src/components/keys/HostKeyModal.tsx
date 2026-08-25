import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';

export interface HostKeyVerificationData {
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  status: 'new' | 'mismatch';
  storedFingerprint?: string;
}

interface HostKeyModalProps {
  isOpen: boolean;
  data: HostKeyVerificationData | null;
  onAccept: (saveToKnownHosts: boolean) => void;
  onReject: () => void;
}

export const HostKeyModal: React.FC<HostKeyModalProps> = ({
  isOpen,
  data,
  onAccept,
  onReject,
}) => {
  if (!data) return null;

  const isMismatch = data.status === 'mismatch';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onReject}
      title={isMismatch ? 'SECURITY WARNING: Host Key Changed!' : 'Unknown Host Key: Verify Authenticity'}
      subtitle={
        isMismatch
          ? 'Potential Man-In-The-Middle attack detected'
          : `First time connecting to ${data.host}:${data.port}`
      }
      icon={
        isMismatch ? (
          <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
        ) : (
          <ShieldQuestion className="w-5 h-5 text-cyan-400" />
        )
      }
      maxWidth="md"
    >
      <div className="space-y-4 text-xs text-slate-300">
        {/* Warning Banner */}
        {isMismatch ? (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              The server host key presented by <strong className="text-white font-mono">{data.host}:{data.port}</strong> does not match the key saved in your known hosts database.
            </p>
            <p className="text-[11px] text-rose-300/80">
              This could mean the server was recently reinstalled, or someone on the network may be attempting a <strong>Man-In-The-Middle (MITM)</strong> interception.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
            <div className="flex items-center gap-2 font-semibold text-cyan-300 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Trust On First Use (TOFU) Verification</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              The authenticity of host <strong className="text-white font-mono">{data.host}:{data.port}</strong> cannot be established from your known hosts list.
            </p>
          </div>
        )}

        {/* Fingerprint Details Card */}
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 font-mono space-y-2">
          <div className="flex justify-between items-center text-[11px] pb-2 border-b border-white/5">
            <span className="text-slate-400">Target Host:</span>
            <span className="text-white font-bold">{data.host}:{data.port}</span>
          </div>

          <div className="flex justify-between items-center text-[11px] pb-2 border-b border-white/5">
            <span className="text-slate-400">Key Algorithm:</span>
            <span className="text-cyan-400">{data.keyType}</span>
          </div>

          {isMismatch && data.storedFingerprint && (
            <div className="pb-2 border-b border-white/5">
              <div className="text-slate-400 text-[10px] uppercase mb-1">Previously Saved Fingerprint:</div>
              <div className="text-rose-400 text-[11px] break-all bg-rose-950/40 p-1.5 rounded border border-rose-900/50 select-all">
                {data.storedFingerprint}
              </div>
            </div>
          )}

          <div>
            <div className="text-slate-400 text-[10px] uppercase mb-1">
              {isMismatch ? 'New / Offending Server Fingerprint:' : 'Server Public Key Fingerprint:'}
            </div>
            <div className="text-emerald-400 text-[11px] break-all bg-emerald-950/30 p-1.5 rounded border border-emerald-900/50 select-all font-bold">
              {data.fingerprint}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
          <button
            onClick={onReject}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>{isMismatch ? 'Abort Connection (Safe)' : 'Cancel'}</span>
          </button>

          {!isMismatch && (
            <button
              onClick={() => onAccept(false)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              Connect Once
            </button>
          )}

          <button
            onClick={() => onAccept(true)}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 ${
              isMismatch
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black shadow-cyan-500/20'
            }`}
          >
            {isMismatch ? <RefreshCw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            <span>{isMismatch ? 'Update Known Host & Connect' : 'Trust & Save to Known Hosts'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
