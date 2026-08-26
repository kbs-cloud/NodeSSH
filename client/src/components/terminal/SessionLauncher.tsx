import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  Server,
  Plus,
  Search,
  Key,
  Network,
  Zap,
  Tag,
  Folder,
  Star,
  Sparkles,
  Command,
  Wifi,
} from 'lucide-react';
import { useTerminal } from '../../context/TerminalContext';
import { useApp } from '../../context/AppContext';
import { ServerProfile } from '../../types';
import { QuickConnectBar } from '../profiles/QuickConnectBar';

export const SessionLauncher: React.FC = () => {
  const { addTab, tabs } = useTerminal();
  const {
    profiles,
    keys,
    tunnels,
    lanIp,
    setActiveView,
    setIsProfileModalOpen,
    setEditingProfile,
    saveProfile,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const getProfileTags = (p: any): string[] => {
    if (!p) return [];
    if (Array.isArray(p.tags)) return p.tags;
    if (typeof p.tags === 'string' && p.tags.trim()) {
      try {
        const parsed = JSON.parse(p.tags);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return p.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const getProfileFolder = (p: any): string => {
    return p?.folder || p?.group_name || 'General';
  };

  const folders = Array.from(new Set(profiles.map(p => getProfileFolder(p))));
  const allTags = Array.from(new Set(profiles.flatMap(p => getProfileTags(p))));

  const handleConnectProfile = (p: ServerProfile) => {
    addTab({
      profile: p,
      title: p.name,
      initialCommand: p.startupCommand,
    });
  };

  const handleToggleFavorite = async (p: ServerProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    await saveProfile({
      ...p,
      isFavorite: !p.isFavorite,
    });
  };

  const filteredProfiles = profiles.filter(p => {
    const folder = getProfileFolder(p);
    const tags = getProfileTags(p);
    if (selectedFolder && folder !== selectedFolder) return false;
    if (selectedTag && !tags.includes(selectedTag)) return false;
    if (
      search &&
      !p.name?.toLowerCase().includes(search.toLowerCase()) &&
      !p.host?.toLowerCase().includes(search.toLowerCase()) &&
      !p.username?.toLowerCase().includes(search.toLowerCase()) &&
      !tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 bg-[var(--theme-bg-dark,#070913)] space-y-6 select-none max-w-6xl mx-auto w-full">
      {/* Hero Welcome & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#0e1222] via-[#151b30] to-[#0e1222] border border-[var(--theme-border,#1e2640)] shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <TerminalIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2 font-mono">
              Node<span className="text-[var(--theme-primary,#00f0ff)]">SSH</span> Terminal Launcher
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Select a remote server profile, start a local shell, or enter quick connect details below.
            </p>
          </div>
        </div>

        {/* Telemetry Stats */}
        <div className="flex items-center gap-3 z-10 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>LAN: {lanIp}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span>{keys.length} Keys</span>
          </div>
          {tabs.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>{tabs.length} Open Session{tabs.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Connect Embedded Card */}
      <div className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Zap className="w-4 h-4 text-cyan-400 fill-current" />
            <span>Ad-Hoc Quick Connect</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">e.g. root@192.168.1.100:22</span>
        </div>
        <div className="pt-1">
          <QuickConnectBar />
        </div>
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Start Local Shell */}
        <button
          onClick={() => addTab({ title: 'Local Shell', profile: undefined })}
          className="flex flex-col items-start p-4 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-cyan-500/40 hover:border-cyan-400 text-left transition-all group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-2 group-hover:scale-110 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white group-hover:text-cyan-300">New Local Shell</span>
          <span className="text-[11px] text-slate-400 mt-0.5">Start local terminal emulator</span>
        </button>

        {/* Add Server Profile */}
        <button
          onClick={() => {
            setEditingProfile(null);
            setIsProfileModalOpen(true);
          }}
          className="flex flex-col items-start p-4 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-purple-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2 group-hover:scale-110 transition-transform">
            <Server className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white group-hover:text-purple-300">New Server Profile</span>
          <span className="text-[11px] text-slate-400 mt-0.5">Save SSH credentials & jump host</span>
        </button>

        {/* Key Vault */}
        <button
          onClick={() => setActiveView('keys')}
          className="flex flex-col items-start p-4 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-emerald-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
            <Key className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white group-hover:text-emerald-300">SSH Key Vault</span>
          <span className="text-[11px] text-slate-400 mt-0.5">Manage & push RSA/Ed25519 keys</span>
        </button>

        {/* SSH Tunnels */}
        <button
          onClick={() => setActiveView('tunnels')}
          className="flex flex-col items-start p-4 rounded-xl bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] hover:border-amber-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-110 transition-transform">
            <Network className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white group-hover:text-amber-300">SSH Tunnels</span>
          <span className="text-[11px] text-slate-400 mt-0.5">{tunnels.length} configured tunnels</span>
        </button>
      </div>

      {/* Saved Server Profiles Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Saved Server Profiles ({profiles.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="flex items-center gap-2 bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs w-64">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter profiles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-white placeholder-slate-500 w-full font-mono text-xs"
              />
            </div>

            <button
              onClick={() => {
                setEditingProfile(null);
                setIsProfileModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Profile</span>
            </button>
          </div>
        </div>

        {/* Folders Filter Pill Strip */}
        {folders.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                selectedFolder === null
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'bg-[#0e1222] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <Folder className="w-3 h-3" />
              <span>All ({profiles.length})</span>
            </button>

            {folders.map(folder => {
              const count = profiles.filter(p => getProfileFolder(p) === folder).length;
              return (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder === selectedFolder ? null : folder)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                    selectedFolder === folder
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                      : 'bg-[#0e1222] text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  <Folder className="w-3 h-3 text-purple-400" />
                  <span>{folder} ({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Profiles Grid */}
        {filteredProfiles.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-black/20 text-slate-500 text-xs space-y-2">
            <div>No matching server profiles found.</div>
            <button
              onClick={() => {
                setEditingProfile(null);
                setIsProfileModalOpen(true);
              }}
              className="text-cyan-400 hover:underline text-xs"
            >
              Click here to create a new profile
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProfiles.map(profile => {
              const folder = getProfileFolder(profile);
              return (
                <div
                  key={profile.id}
                  onClick={() => handleConnectProfile(profile)}
                  className="p-3.5 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 shadow-md hover:shadow-cyan-950/20 transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden"
                >
                  {/* Color tag indicator */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: profile.colorTag || '#00f0ff' }}
                  />

                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className="p-1.5 rounded-lg shrink-0"
                        style={{
                          backgroundColor: `${profile.colorTag || '#00f0ff'}1a`,
                          color: profile.colorTag || '#00f0ff',
                        }}
                      >
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors truncate">
                          {profile.name}
                        </h3>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {profile.username}@{profile.host}:{profile.port}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={e => handleToggleFavorite(profile, e)}
                      className="p-1 text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                      title="Favorite profile"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          profile.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Badges & Connect Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                    <div className="flex items-center gap-1 text-slate-400 font-mono truncate">
                      <Folder className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{folder}</span>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleConnectProfile(profile);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--theme-primary,#00f0ff)]/10 hover:bg-[var(--theme-primary,#00f0ff)] text-[var(--theme-primary,#00f0ff)] hover:text-black font-semibold text-xs transition-colors shrink-0"
                    >
                      <TerminalIcon className="w-3 h-3" />
                      <span>Connect</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-white/5 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0e1222] border border-white/10 rounded text-slate-400 text-[10px]">
            Ctrl+Shift+T
          </kbd>
          <span>New Session</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0e1222] border border-white/10 rounded text-slate-400 text-[10px]">
            Ctrl+W
          </kbd>
          <span>Close Session</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0e1222] border border-white/10 rounded text-slate-400 text-[10px]">
            Ctrl+1..9
          </kbd>
          <span>Switch Tabs</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0e1222] border border-white/10 rounded text-slate-400 text-[10px]">
            Ctrl+Shift+E
          </kbd>
          <span>Multi-Exec Broadcast</span>
        </div>
      </div>
    </div>
  );
};
