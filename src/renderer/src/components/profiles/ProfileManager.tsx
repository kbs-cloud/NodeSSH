import React, { useState } from 'react';
import {
  Server,
  Plus,
  Search,
  Upload,
  Star,
  Terminal as TerminalIcon,
  Edit,
  Trash2,
  Folder,
  Shield,
  Zap,
  Tag,
  Key,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTerminal } from '../../context/TerminalContext';
import { ServerProfile } from '../../types';
import { ProfileModal } from './ProfileModal';
import { ImportExportModal } from './ImportExportModal';
import { QuickConnectBar } from './QuickConnectBar';

export const ProfileManager: React.FC = () => {
  const {
    profiles,
    setIsProfileModalOpen,
    setEditingProfile,
    deleteProfile,
    saveProfile,
    setIsImportExportOpen,
    setActiveView,
  } = useApp();

  const { addTab } = useTerminal();

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

  // Extract all unique folders and tags
  const folders = Array.from(new Set(profiles.map(p => getProfileFolder(p))));
  const allTags = Array.from(new Set(profiles.flatMap(p => getProfileTags(p))));

  const handleConnect = (p: ServerProfile) => {
    addTab({
      profile: p,
      title: p.name,
      initialCommand: p.startupCommand,
    });
    setActiveView('terminals');
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
    <div className="flex-1 h-full overflow-y-auto p-5 bg-[var(--theme-bg-dark,#070913)] space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Server className="w-6 h-6 text-cyan-400" />
            Server Profiles & Connection Manager
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize servers into folders, configure jump hosts, key authentication, and startup commands
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1222] hover:bg-[#151b30] border border-[var(--theme-border,#1e2640)] text-slate-200 text-xs font-semibold shadow-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>Import / Export</span>
          </button>

          <button
            onClick={() => {
              setEditingProfile(null);
              setIsProfileModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 text-black font-bold text-xs shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Server Profile</span>
          </button>
        </div>
      </div>

      {/* Quick Connect Bar */}
      <QuickConnectBar />

      {/* Folders Bar */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              selectedFolder === null
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'bg-[#0e1222] text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>All Folders ({profiles.length})</span>
          </button>

          {folders.map(folder => {
            const count = profiles.filter(p => getProfileFolder(p) === folder).length;
            return (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder === selectedFolder ? null : folder)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  selectedFolder === folder
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                    : 'bg-[#0e1222] text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-purple-400" />
                <span>{folder} ({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0e1222] border border-[var(--theme-border,#1e2640)] rounded-lg px-3 py-1.5 text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search servers by name, IP, user, or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-slate-500 w-full font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Found: <strong className="text-cyan-400 font-mono">{filteredProfiles.length}</strong> servers</span>
        </div>
      </div>

      {/* Tags Filter Pill Strip */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 flex items-center gap-1 text-[11px]">
            <Tag className="w-3 h-3" /> Filter by Tag:
          </span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-2 py-0.5 rounded-full border transition-colors ${
              selectedTag === null ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                selectedTag === tag ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Profiles Grid */}
      {filteredProfiles.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-black/20 text-slate-500 text-xs">
          No server profiles found. Click &quot;New Server Profile&quot; to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProfiles.map(profile => {
            const folder = getProfileFolder(profile);
            const tags = getProfileTags(profile);
            const isKeyAuth = profile.authType === 'key' || (profile as any).auth_type === 'key';
            return (
              <div
                key={profile.id}
                onClick={() => handleConnect(profile)}
                className="p-4 rounded-xl bg-[#0e1222] border border-[var(--theme-border,#1e2640)] hover:border-cyan-500/50 shadow-lg hover:shadow-cyan-950/20 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden"
              >
                {/* Color tag indicator bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: profile.colorTag || '#00f0ff' }}
                />

                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: `${profile.colorTag || '#00f0ff'}1a`,
                        color: profile.colorTag || '#00f0ff',
                      }}
                    >
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                        {profile.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                        <span>{profile.username}@{profile.host}:{profile.port}</span>
                      </div>
                    </div>
                  </div>

                  {/* Favorite toggle */}
                  <button
                    onClick={e => handleToggleFavorite(profile, e)}
                    className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                    title="Favorite profile"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        profile.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Badges & Meta */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300 font-mono flex items-center gap-1">
                    <Folder className="w-3 h-3 text-cyan-400" />
                    {folder}
                  </span>

                  <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300 font-mono flex items-center gap-1">
                    {isKeyAuth ? (
                      <>
                        <Key className="w-3 h-3 text-purple-400" />
                        Key Vault
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-emerald-400" />
                        Password
                      </>
                    )}
                  </span>

                  {(profile.jumpHostId || (profile as any).jump_host_id) && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/40 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Bastion
                    </span>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {tags.map(t => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400 text-[10px]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleConnect(profile);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--theme-primary,#00f0ff)]/10 hover:bg-[var(--theme-primary,#00f0ff)] text-[var(--theme-primary,#00f0ff)] hover:text-black font-semibold text-xs transition-colors"
                  >
                    <TerminalIcon className="w-3.5 h-3.5" />
                    <span>Launch Terminal</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingProfile(profile);
                        setIsProfileModalOpen(true);
                      }}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Edit Profile"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Delete profile "${profile.name}"?`)) {
                          deleteProfile(profile.id);
                        }
                      }}
                      className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ProfileModal />
      <ImportExportModal />
    </div>
  );
};
