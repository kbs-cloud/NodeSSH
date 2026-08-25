import React, { useState } from 'react';
import {
  Key,
  Plus,
  Upload,
  Copy,
  Check,
  Download,
  Send,
  Trash2,
  Shield,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KeyVaultItem } from '../../types';
import { KeyGenModal } from './KeyGenModal';
import { KeyImportModal } from './KeyImportModal';
import { PushKeyModal } from './PushKeyModal';

export const KeyVault: React.FC = () => {
  const {
    keys,
    setIsKeyGenOpen,
    setIsKeyImportOpen,
    setIsPushKeyOpen,
    setPushKeyTarget,
    deleteKey,
    showToast,
  } = useApp();

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const copyPublicKey = (key: KeyVaultItem) => {
    navigator.clipboard.writeText(key.publicKey);
    setCopiedKeyId(key.id);
    showToast(`Copied public key for "${key.name}"`, 'info');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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

  return (
    <div className="flex-1 h-full overflow-y-auto p-5 bg-[var(--theme-bg-dark,#070913)] space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Key className="w-6 h-6 text-cyan-400" />
            SSH Key Vault & Cryptographic Manager
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            AES-256-GCM encrypted private keys, in-browser Ed25519 & RSA generation, and 1-click ssh-copy-id
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsKeyImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] text-slate-200 text-xs font-semibold shadow-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>Import Private Key</span>
          </button>

          <button
            onClick={() => setIsKeyGenOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-bold text-xs shadow-lg transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Keypair</span>
          </button>
        </div>
      </div>

      {/* Summary Info Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#0e1222] via-[#151b30] to-[#0e1222] border border-cyan-500/30 text-xs shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">Secure Per-User Vault</h4>
            <p className="text-slate-400 text-xs mt-0.5">
              Private keys are protected by hardware/WebCrypto isolation and zero-knowledge database encryption.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
          <span>Total Keys: <strong className="text-cyan-400">{keys.length}</strong></span>
        </div>
      </div>

      {/* Key Cards Grid */}
      {keys.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/20 text-slate-500 text-xs">
          No SSH keys in vault yet. Click &quot;Generate Keypair&quot; to create a modern Ed25519 key.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keys.map(key => {
            const isEd = key.type === 'ed25519';

            return (
              <div
                key={key.id}
                className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 shadow-lg flex flex-col justify-between gap-3 group transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{key.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          isEd
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}>
                          {key.type.toUpperCase()} {key.bits ? `(${key.bits}-bit)` : ''}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete key "${key.name}" from vault?`)) {
                        deleteKey(key.id);
                      }
                    }}
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Fingerprint */}
                <div className="p-2.5 bg-black/40 rounded-lg border border-white/5 font-mono text-[11px] text-slate-300">
                  <div className="text-[10px] text-slate-500 mb-1">SHA256 Fingerprint:</div>
                  <div className="text-cyan-300 truncate">{key.fingerprint}</div>
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyPublicKey(key)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-[11px] transition-colors"
                      title="Copy public key (OpenSSH format)"
                    >
                      {copiedKeyId === key.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-cyan-400" />
                          <span>Copy PubKey</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => downloadFile(`${key.name.replace(/\s+/g, '_')}.pub`, key.publicKey)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                      title="Download Public Key (.pub)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setPushKeyTarget(key);
                      setIsPushKeyOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--theme-primary,#00f0ff)]/15 hover:bg-[var(--theme-primary,#00f0ff)] text-[var(--theme-primary,#00f0ff)] hover:text-black font-semibold text-xs transition-colors shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>Push to Server (ssh-copy-id)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <KeyGenModal />
      <KeyImportModal />
      <PushKeyModal />
    </div>
  );
};
