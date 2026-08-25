import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Key, Sparkles, Download, Copy, Check, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateEd25519KeyPair, generateRSAKeyPair } from '../../utils/sshKeygen';
import { KeyVaultItem } from '../../types';

export const KeyGenModal: React.FC = () => {
  const { isKeyGenOpen, setIsKeyGenOpen, saveKey, showToast } = useApp();

  const [keyType, setKeyType] = useState<'ed25519' | 'rsa'>('ed25519');
  const [rsaBits, setRsaBits] = useState<2048 | 4096>(4096);
  const [name, setName] = useState('My Ed25519 SSH Key');
  const [comment, setComment] = useState('nodessh-user@vault');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{
    publicKey: string;
    privateKey: string;
    fingerprint: string;
  } | null>(null);

  const [copiedPub, setCopiedPub] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let result;
      if (keyType === 'ed25519') {
        result = await generateEd25519KeyPair(comment);
      } else {
        result = await generateRSAKeyPair(rsaBits, comment);
      }
      setGeneratedKey(result);
    } catch (err: any) {
      showToast(err.message || 'Key generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!generatedKey) return;
    const newItem: KeyVaultItem = {
      id: 'key-' + Date.now(),
      name: name.trim() || 'New SSH Key',
      type: keyType,
      publicKey: generatedKey.publicKey,
      privateKey: generatedKey.privateKey,
      fingerprint: generatedKey.fingerprint,
      bits: keyType === 'rsa' ? rsaBits : undefined,
      comment,
      createdAt: new Date().toISOString(),
    };

    await saveKey(newItem);
    setIsKeyGenOpen(false);
    setGeneratedKey(null);
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
  };

  return (
    <Modal
      isOpen={isKeyGenOpen}
      onClose={() => {
        setIsKeyGenOpen(false);
        setGeneratedKey(null);
      }}
      title="Generate SSH Key Pair"
      subtitle="In-Browser Cryptographic Key Generation using Web Crypto API"
      icon={<Sparkles className="w-5 h-5" />}
      maxWidth="2xl"
    >
      {!generatedKey ? (
        <div className="space-y-4 text-xs text-slate-200">
          {/* Key Algorithm Selection */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Key Algorithm</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setKeyType('ed25519');
                  setName('My Ed25519 SSH Key');
                }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  keyType === 'ed25519'
                    ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-md'
                    : 'bg-[#070913] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs text-cyan-300">Ed25519 (Recommended)</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Modern 256-bit elliptic curve, ultra-fast and quantum-resilient.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setKeyType('rsa');
                  setName('My RSA SSH Key');
                }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  keyType === 'rsa'
                    ? 'bg-purple-500/10 border-purple-400 text-white shadow-md'
                    : 'bg-[#070913] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs text-purple-300">RSA (Legacy / Broad Compatibility)</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Standard RSA key with 2048 or 4096 bits modulus length.
                </div>
              </button>
            </div>
          </div>

          {keyType === 'rsa' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Modulus Size (Bits)</label>
              <div className="flex gap-3">
                {[2048, 4096].map(bits => (
                  <button
                    key={bits}
                    type="button"
                    onClick={() => setRsaBits(bits as any)}
                    className={`px-4 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      rsaBits === bits
                        ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold'
                        : 'bg-[#070913] border-white/10 text-slate-400'
                    }`}
                  >
                    {bits} Bits
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Key Name & Comment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Key Name in Vault</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Comment / Label</label>
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsKeyGenOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-semibold text-xs shadow-lg transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Generating Keypair...' : 'Generate Keypair'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Key Generated Results */
        <div className="space-y-4 text-xs text-slate-200">
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-emerald-300">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Keypair generated successfully! Public fingerprint: <strong>{generatedKey.fingerprint}</strong></span>
          </div>

          {/* Public Key Display */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">Public Key (OpenSSH Format)</label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey.publicKey);
                  setCopiedPub(true);
                  setTimeout(() => setCopiedPub(false), 2000);
                }}
                className="flex items-center gap-1 text-cyan-400 hover:underline"
              >
                {copiedPub ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPub ? 'Copied!' : 'Copy Public Key'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={3}
              value={generatedKey.publicKey}
              className="w-full bg-[#070913] border border-white/10 rounded-lg p-2.5 text-cyan-300 font-mono text-[11px] outline-none"
            />
          </div>

          {/* Download options */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => downloadFile('id_nodessh.pub', generatedKey.publicKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-300 font-mono text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download id_nodessh.pub</span>
            </button>

            <button
              type="button"
              onClick={() => downloadFile('id_nodessh.pem', generatedKey.privateKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-300 font-mono text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download id_nodessh.pem (Private)</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setGeneratedKey(null)}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSaveToVault}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-semibold text-xs shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Key to Vault</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
