import React, { useState, useEffect } from 'react';
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
  Server,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KeyVaultItem } from '../../types';
import { api } from '../../services/api';
import { KeyGenModal } from './KeyGenModal';
import { KeyImportModal } from './KeyImportModal';
import { PushKeyModal } from './PushKeyModal';

interface KnownHostItem {
  id: string;
  host: string;
  port: number;
  key_type: string;
  fingerprint: string;
  created_at: string;
  updated_at: string;
}

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

  const [activeTab, setActiveTab] = useState<'vault' | 'known_hosts'>('vault');
  const [knownHosts, setKnownHosts] = useState<KnownHostItem[]>([]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const fetchKnownHosts = async () => {
    const hosts = await api.getKnownHosts();
    setKnownHosts(hosts);
  };

  useEffect(() => {
    if (activeTab === 'known_hosts') {
      fetchKnownHosts();
    }
  }, [activeTab]);

  const copyPublicKey = (key: KeyVaultItem) => {
    navigator.clipboard.writeText(key.publicKey);
    setCopiedKeyId(key.id);
    showToast(`Copied public key for "${key.name}"`, 'info');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const copyFingerprint = (id: string, fingerprint: string) => {
    navigator.clipboard.writeText(fingerprint);
    setCopiedKeyId(id);
    showToast('Copied host fingerprint', 'info');
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

  const handleDeleteKnownHost = async (id: string, host: string) => {
    if (confirm(`Remove trusted host key for "${host}"? You will be prompted to re-verify next time you connect.`)) {
      await api.deleteKnownHost(id);
      setKnownHosts(prev => prev.filter(h => h.id !== id));
      showToast(`Removed known host "${host}"`, 'info');
    }
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
            AES-256-GCM encrypted private keys, in-browser Ed25519/RSA keygen, known_hosts TOFU verification, and 1-click ssh-copy-id
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'vault'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Private Keys Vault</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono font-normal">
            {keys.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('known_hosts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'known_hosts'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Known Server Hosts (TOFU)</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono font-normal">
            {knownHosts.length}
          </span>
        </button>
      </div>

      {/* Tab Content: Vault vs Known Hosts */}
      {activeTab === 'vault' ? (
        <>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {keys.map(key => {
                const effectiveType = key.type || key.keyType || 'ed25519';
                const isEd25519 = effectiveType === 'ed25519';
                return (
                  <div
                    key={key.id}
                    className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 shadow-md space-y-3 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isEd25519 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'}`}>
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-sm">{key.name}</h3>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">
                              {effectiveType} {key.bits ? `(${key.bits}-bit)` : ''}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteKey(key.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Fingerprint */}
                      <div className="mt-3 p-2 rounded bg-black/40 border border-white/5 text-[11px] font-mono text-slate-400 select-all break-all">
                        {key.fingerprint}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copyPublicKey(key)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
                          title="Copy OpenSSH Public Key"
                        >
                          {copiedKeyId === key.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
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
        </>
      ) : (
        /* Known Hosts Tab */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0e1222] border border-cyan-500/30 text-xs text-slate-300 space-y-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Trusted Known Hosts (TOFU Security Database)
            </h4>
            <p className="text-slate-400">
              When connecting to a remote server, NodeSSH verifies the server host key against this list to prevent Man-In-The-Middle attacks.
            </p>
          </div>

          {knownHosts.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/20 text-slate-500 text-xs">
              No known host keys stored yet. Connecting to any foreign server will prompt you to verify and save its host key.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {knownHosts.map(host => (
                <div
                  key={host.id}
                  className="p-3.5 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/40 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <div>
                        <h4 className="font-bold text-white text-sm font-mono">{host.host}:{host.port}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{host.key_type}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteKnownHost(host.id, host.host)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Revoke / Delete Known Host"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span className="truncate">{host.fingerprint}</span>
                    <button
                      onClick={() => copyFingerprint(host.id, host.fingerprint)}
                      className="ml-2 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Copy Fingerprint"
                    >
                      {copiedKeyId === host.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last verified: {new Date(host.updated_at).toLocaleDateString()}
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Trusted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <KeyGenModal />
      <KeyImportModal />
      <PushKeyModal />
    </div>
  );
};
