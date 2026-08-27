import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { LogIn, UserPlus, Lock, Mail, User as UserIcon, Shield, Cloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SSOLoginPanel } from '../../_shared/auth/SSOLoginPanel';
import { useTheme } from '../../context/ThemeContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, login, register, loginWithSSO, logout, error, clearError, isLoading } = useAuth();
  const { themeConfig } = useTheme();

  const [activeTab, setActiveTab] = useState<'local-login' | 'local-register' | 'sso'>('sso');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGooglePolling, setIsGooglePolling] = useState(false);
  const [playOnline, setPlayOnline] = useState(true);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      onClose();
    } catch {}
  };

  const handleLocalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ username, email, password });
      onClose();
    } catch {}
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAuthenticated ? `User Account: ${user?.username}` : 'NodeSSH Authentication'}
      subtitle={isAuthenticated ? `Logged in via ${user?.authType?.toUpperCase() || 'Local'}` : 'Local credentials or KBS Cloud SSO'}
      icon={<Shield className="w-5 h-5" />}
      maxWidth="md"
    >
      {isAuthenticated ? (
        <div className="space-y-4 text-xs text-slate-200">
          <div className="p-4 rounded-xl bg-[#0e1222] border border-cyan-500/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-bold text-base">
              {user?.username?.slice(0, 2).toUpperCase() || 'US'}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{user?.username}</h3>
              <p className="text-slate-400 text-xs">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                {user?.authType === 'sso' ? 'KBS Cloud SSO' : 'Local Auth'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              onClick={() => {
                logout();
              }}
              className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-semibold transition-colors"
            >
              Sign Out
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-xs text-slate-200">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => {
                clearError();
                setActiveTab('sso');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'sso'
                  ? 'border-[var(--theme-primary,#00f0ff)] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>KBS Cloud SSO</span>
            </button>

            <button
              onClick={() => {
                clearError();
                setActiveTab('local-login');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'local-login'
                  ? 'border-[var(--theme-primary,#00f0ff)] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Local Login</span>
            </button>

            <button
              onClick={() => {
                clearError();
                setActiveTab('local-register');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'local-register'
                  ? 'border-[var(--theme-primary,#00f0ff)] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register</span>
            </button>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {activeTab === 'sso' && (
            <div className="py-2">
              <SSOLoginPanel
                title="KBS CLOUD SSO"
                subtitle="Centralized Identity & Multi-tenant Vault"
                themeColor={themeConfig.primary}
                isGooglePolling={isGooglePolling}
                playOnline={playOnline}
                onPlayOnlineChange={setPlayOnline}
                onLoginClick={() => {
                  loginWithSSO();
                }}
                onCancelGooglePoll={() => setIsGooglePolling(false)}
                buttonText="CONTINUE WITH KBS SSO"
              />
            </div>
          )}

          {activeTab === 'local-login' && (
            <form onSubmit={handleLocalLogin} className="space-y-3 py-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username..."
                    className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg pl-9 pr-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg pl-9 pr-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-bold text-xs shadow-lg transition-all"
                >
                  {isLoading ? 'Authenticating...' : 'Sign In Locally'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'local-register' && (
            <form onSubmit={handleLocalRegister} className="space-y-3 py-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Choose username..."
                    className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg pl-9 pr-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg pl-9 pr-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create strong password..."
                    className="w-full bg-[#070913] border border-[var(--theme-border,#1e2640)] rounded-lg pl-9 pr-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-primary,#00f0ff)] hover:opacity-90 disabled:opacity-50 text-black font-bold text-xs shadow-lg transition-all"
                >
                  {isLoading ? 'Creating Account...' : 'Register Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
};
