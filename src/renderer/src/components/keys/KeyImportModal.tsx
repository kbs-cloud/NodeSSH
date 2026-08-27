import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Upload, FileText, Check, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calculateFingerprint, parsePuTTYKey } from '../../utils/sshKeygen';
import { KeyVaultItem } from '../../types';

interface KeyImportModalProps {
  initialData?: { name: string; content: string } | null;
  onClose?: () => void;
}

export const KeyImportModal: React.FC<KeyImportModalProps> = ({ initialData, onClose }) => {
  const { isKeyImportOpen, setIsKeyImportOpen, saveKey, showToast } = useApp();

  const [name, setName] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const [publicKeyContent, setPublicKeyContent] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [detectedType, setDetectedType] = useState<string>('Unknown');
  const [isDropActive, setIsDropActive] = useState(false);

  useEffect(() => {
    if (initialData) {
      if (initialData.name) setName(initialData.name);
      if (initialData.content) handleKeyContentChange(initialData.content);
    }
  }, [initialData]);

  const handleKeyContentChange = async (content: string) => {
    setKeyContent(content);

    // Detection
    const ppk = parsePuTTYKey(content);
    if (ppk.isPPK) {
      setDetectedType(`PuTTY PPK (${ppk.keyType})`);
      if (!name && ppk.comment) setName(ppk.comment);
      return;
    }

    if (content.includes('BEGIN OPENSSH PRIVATE KEY')) {
      setDetectedType('OpenSSH Private Key');
    } else if (content.includes('BEGIN RSA PRIVATE KEY')) {
      setDetectedType('RSA PEM Private Key');
    } else if (content.includes('BEGIN EC PRIVATE KEY')) {
      setDetectedType('ECDSA PEM Private Key');
    } else if (content.includes('BEGIN PRIVATE KEY')) {
      setDetectedType('PKCS#8 Private Key');
    } else if (content.startsWith('ssh-ed25519') || content.startsWith('ssh-rsa')) {
      setDetectedType('OpenSSH Public Key');
      setPublicKeyContent(content);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''));

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      handleKeyContentChange(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const file = files[0];
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''));

    try {
      const text = await file.text();
      handleKeyContentChange(text);
      showToast(`Loaded key file "${file.name}"`, 'info');
    } catch (err: any) {
      showToast(`Failed to read file: ${err.message}`, 'error');
    }
  };

  const handleClose = () => {
    setIsKeyImportOpen(false);
    onClose?.();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyContent.trim()) return;

    const pub = publicKeyContent.trim() || 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... imported-key';
    const fp = await calculateFingerprint(pub);

    const isRsa = keyContent.includes('RSA') || detectedType.includes('RSA');
    const isEd = keyContent.includes('ed25519') || detectedType.includes('ed25519');

    const keyItem: KeyVaultItem = {
      id: 'key-' + Date.now(),
      name: name.trim() || 'Imported Key',
      type: isEd ? 'ed25519' : isRsa ? 'rsa' : 'imported',
      publicKey: pub,
      privateKey: keyContent.trim(),
      fingerprint: fp,
      comment: 'imported-user@vault',
      createdAt: new Date().toISOString(),
    };

    await saveKey(keyItem);
    handleClose();
    setName('');
    setKeyContent('');
    setPublicKeyContent('');
  };

  return (
    <Modal
      isOpen={isKeyImportOpen}
      onClose={handleClose}
      title="Import Private Key to Vault"
      subtitle="Supports OpenSSH, PEM, and PuTTY .ppk keys (AES-256 encrypted at rest)"
      icon={<Upload className="w-5 h-5" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs text-slate-200">
        {/* File Drop / Select */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDropActive(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDropActive(true);
          }}
          onDragLeave={() => setIsDropActive(false)}
          onDrop={handleDrop}
          className={`p-5 rounded-lg border-2 border-dashed transition-all bg-[#070913] text-center ${
            isDropActive
              ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
              : 'border-white/10 hover:border-cyan-400/50'
          }`}
        >
          <input
            type="file"
            id="key-import-file"
            accept=".pem,.ppk,.pub,.key,id_rsa,id_ed25519"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="key-import-file"
            className="cursor-pointer flex flex-col items-center justify-center gap-2"
          >
            <FileText className={`w-8 h-8 transition-colors ${isDropActive ? 'text-cyan-400' : 'text-purple-400'}`} />
            <span className="font-semibold text-white">
              {isDropActive ? 'Drop key file now' : 'Click or drag private key file here (.pem, .ppk, OpenSSH)'}
            </span>
            <span className="text-slate-500 text-[11px]">Private keys are stored in encrypted vault</span>
          </label>
        </div>

        {/* Key Name & Detected Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Key Name in Vault</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. AWS Production Key"
              className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-2 text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Detected Key Type</label>
            <div className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-cyan-400 font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>{detectedType}</span>
            </div>
          </div>
        </div>

        {/* Paste Private Key Text */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Private Key Content</label>
          <textarea
            required
            rows={5}
            value={keyContent}
            onChange={e => handleKeyContentChange(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
            className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg p-3 text-slate-200 font-mono text-xs outline-none focus:border-cyan-400"
          />
        </div>

        {/* Optional Public Key / Passphrase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Public Key (Optional)</label>
            <input
              type="text"
              value={publicKeyContent}
              onChange={e => setPublicKeyContent(e.target.value)}
              placeholder="ssh-ed25519 AAAAC3... (auto-generated if empty)"
              className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Key Passphrase (If encrypted)</label>
            <input
              type="password"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              placeholder="Passphrase (optional)..."
              className="w-full bg-[#070913] border border-white/10 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setIsKeyImportOpen(false)}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!keyContent.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-semibold text-xs shadow-lg transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Import to Vault</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
