import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState } from '../types';
import { storage } from '../services/storage';
import { api } from '../services/api';
import { redirectToSSO, startSSOBackgroundCheck } from '../_shared/auth/sso-helper';

interface AuthContextType extends AuthState {
  login: (credentials: { username: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  loginWithSSO: () => void;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const token = storage.getToken();
    const user = storage.getUser();
    return {
      user: user || {
        id: 'usr-default',
        username: 'admin',
        email: 'admin@nodessh.local',
        authType: 'local',
      },
      token: token || 'default-session-token',
      isAuthenticated: true,
      isOfflineMode: false,
      isLoading: false,
      error: null,
    };
  });

  const checkCurrentUser = useCallback(async () => {
    try {
      const user = await api.getMe();
      if (user) {
        setAuthState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
        }));
      }
    } catch {
      // Keep offline/cached user
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Check if token in URL query
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        storage.setToken(urlToken);
        params.delete('token');
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, '', `${window.location.pathname}${newSearch}`);
      }
    }

    checkCurrentUser();

    // Start subtle background check for KBS SSO if unauthenticated
    const cleanup = startSSOBackgroundCheck({
      clientId: 'nodessh',
      onSuccess: () => {
        checkCurrentUser();
      },
      onFinished: () => {},
    });

    return () => {
      cleanup?.();
    };
  }, [checkCurrentUser]);

  const login = async (credentials: { username: string; password: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user, token } = await api.login(credentials);
      storage.setToken(token);
      storage.setUser(user);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isOfflineMode: false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Login failed',
      }));
      throw err;
    }
  };

  const register = async (data: { username: string; email: string; password: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user, token } = await api.register(data);
      storage.setToken(token);
      storage.setUser(user);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isOfflineMode: false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Registration failed',
      }));
      throw err;
    }
  };

  const loginWithSSO = () => {
    redirectToSSO('nodessh');
  };

  const logout = () => {
    storage.setToken(null);
    storage.setUser(null);
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isOfflineMode: false,
      isLoading: false,
      error: null,
    });
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        loginWithSSO,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
