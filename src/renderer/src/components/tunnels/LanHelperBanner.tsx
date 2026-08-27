import React, { useState } from 'react';
import { Wifi, Copy, Check, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LanHelperBanner: React.FC = () => {
  const { lanIp, showToast } = useApp();
  const [copied, setCopied] = useState(false);

  const copyIp = () => {
    navigator.clipboard.writeText(lanIp);
    setCopied(true);
    showToast(`Copied LAN IP: ${lanIp}`, 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-[#0e1222] via-[#151b30] to-[#0e1222] border border-cyan-500/30 text-xs shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
          <Wifi className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white text-sm">LAN Sharing Helper</h4>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[11px] border border-cyan-500/30">
              Bind: 0.0.0.0
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            When your SSH tunnels bind to <code className="text-cyan-300 font-mono">0.0.0.0</code>, other devices on your local WiFi/Ethernet network can connect directly to your PC’s IP address to route through your SSH tunnels.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-cyan-500/40 font-mono text-cyan-400 font-bold">
          <span>{lanIp}</span>
          <button
            onClick={copyIp}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
            title="Copy LAN IP address"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
