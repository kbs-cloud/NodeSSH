import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppTheme, ThemeConfig } from '../types';
import { THEME_CONFIGS, XTERM_THEMES } from '../utils/themes';
import { storage } from '../services/storage';
import { ITheme } from '@xterm/xterm';

interface ThemeContextType {
  theme: AppTheme;
  themeConfig: ThemeConfig;
  xtermTheme: ITheme;
  setTheme: (theme: AppTheme) => void;
  availableThemes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return storage.getSettings().theme || 'cyberpunk';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    const settings = storage.getSettings();
    settings.theme = newTheme;
    storage.saveSettings(settings);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const themeConfig = THEME_CONFIGS[theme] || THEME_CONFIGS.cyberpunk;
  const xtermTheme = XTERM_THEMES[theme] || XTERM_THEMES.cyberpunk;
  const availableThemes = Object.values(THEME_CONFIGS);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeConfig,
        xtermTheme,
        setTheme,
        availableThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
