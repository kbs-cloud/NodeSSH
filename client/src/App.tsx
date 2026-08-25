import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { TerminalProvider } from './context/TerminalContext';
import { AppLayout } from './components/layout/AppLayout';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <TerminalProvider>
            <AppLayout />
          </TerminalProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
