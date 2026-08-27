import React, { useState, useEffect } from 'react';

export interface SSOLoginPanelProps {
  title: string;
  subtitle: string;
  authError?: string;
  buttonText?: string;
  isGooglePolling: boolean;
  playOnline: boolean;
  onPlayOnlineChange: (playOnline: boolean) => void;
  onLoginClick: () => void;
  onCancelGooglePoll: () => void;
  themeColor?: string; // Hex color e.g. '#9d4edf'
  icon?: React.ReactNode;
  
  containerClassName?: string;
  cardClassName?: string;
  buttonClassName?: string;
  bgElement?: React.ReactNode;
}

export const SSOLoginPanel: React.FC<SSOLoginPanelProps> = ({
  title,
  subtitle,
  authError,
  buttonText = 'ESTABLISH SECURE CONNECTION',
  isGooglePolling,
  playOnline,
  onPlayOnlineChange,
  onLoginClick,
  onCancelGooglePoll,
  themeColor = '#00f0ff',
  icon,
  containerClassName = '',
  cardClassName = '',
  buttonClassName = '',
  bgElement
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 800);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Default Inline Styles for robustness across Tailwind and CSS setups
  const defaultContainerStyle: React.CSSProperties = {
    boxSizing: 'border-box',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: '16px',
    position: 'relative',
    backgroundColor: 'transparent',
  };

  const defaultCardStyle: React.CSSProperties = {
    boxSizing: 'border-box',
    textAlign: 'center',
    width: '100%',
    maxWidth: windowWidth < 480 ? '92%' : '420px',
    background: 'rgba(10, 5, 20, 0.65)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderTop: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    padding: windowWidth < 480 ? '24px 16px' : '36px 32px',
    boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 25px ${themeColor}1a, inset 0 0 15px ${themeColor}0d`,
    fontFamily: "'Share Tech Mono', monospace, sans-serif",
    color: '#f8fafc',
    transition: 'all 0.3s ease',
  };

  const defaultHeaderStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const defaultIconStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: themeColor,
    margin: '0 auto 16px',
    filter: `drop-shadow(0 0 8px ${themeColor})`,
  };

  const defaultTitleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '2px',
    color: themeColor,
    textShadow: `0 0 10px ${themeColor}66`,
    margin: 0,
  };

  const defaultSubtitleStyle: React.CSSProperties = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: themeColor,
    opacity: 0.85,
    margin: '6px 0 0',
  };

  const defaultErrorStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#ff007f',
    textShadow: '0 0 4px rgba(255, 0, 127, 0.2)',
    background: 'rgba(255, 0, 127, 0.1)',
    border: '1px solid rgba(255, 0, 127, 0.3)',
    borderRadius: '8px',
    marginBottom: '24px',
    padding: '12px',
    fontSize: '12px',
  };

  const defaultDescStyle: React.CSSProperties = {
    color: '#94a3b8',
    marginBottom: '32px',
    fontSize: '14px',
    lineHeight: '1.6',
  };

  const defaultButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 24px',
    fontSize: '13px',
    letterSpacing: '1.5px',
    fontWeight: 'bold',
    color: '#05030d',
    background: isHovered ? '#ffffff' : themeColor,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: isHovered ? `0 0 20px #ffffff` : `0 0 12px ${themeColor}59`,
    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    textTransform: 'uppercase',
  };

  const defaultToggleStyle: React.CSSProperties = {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    paddingTop: '16px',
    display: 'flex',
    marginTop: '24px',
  };

  const defaultLabelStyle: React.CSSProperties = {
    color: '#94a3b8',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    display: 'flex',
  };

  const defaultCheckboxStyle: React.CSSProperties = {
    cursor: 'pointer',
    accentColor: themeColor,
  };

  const spinnerStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(255, 255, 255, 0.05)',
    borderTop: `3px solid ${themeColor}`,
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'sso-spin 1s linear infinite'
  };

  // Inject animation keyframes dynamically if in browser
  if (typeof document !== 'undefined' && !document.getElementById('sso-panel-animations')) {
    const style = document.createElement('style');
    style.id = 'sso-panel-animations';
    style.innerHTML = `
      @keyframes sso-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  if (isGooglePolling) {
    return (
      <div className={containerClassName} style={containerClassName ? undefined : defaultContainerStyle}>
        {bgElement}
        <div className={cardClassName} style={cardClassName ? undefined : defaultCardStyle}>
          <div style={defaultContainerStyle.boxSizing ? { marginBottom: '24px' } : undefined}>
            <h2 style={defaultTitleStyle}>ESTABLISHING SECURE LINK</h2>
            <p style={defaultSubtitleStyle}>Trans-Node Authorization</p>
          </div>
          <p style={defaultDescStyle}>
            Please complete authentication in your default web browser window.
          </p>
          <div style={spinnerStyle} />
          <p style={{ ...defaultDescStyle, fontSize: '11px', textTransform: 'uppercase', marginBottom: '24px' }}>
            [Waiting for browser validation...]
          </p>
          <button 
            onClick={onCancelGooglePoll}
            style={{
              ...defaultButtonStyle,
              background: 'rgba(220, 20, 60, 0.15)',
              border: '1px solid rgba(220, 20, 60, 0.4)',
              color: '#ff4d4d',
              boxShadow: 'none'
            }}
          >
            Cancel Authentication Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} style={containerClassName ? undefined : defaultContainerStyle}>
      {bgElement}
      <div className={cardClassName} style={cardClassName ? undefined : defaultCardStyle}>
        <div style={defaultHeaderStyle}>
          {icon && <div style={defaultIconStyle}>{icon}</div>}
          <h1 style={defaultTitleStyle}>{title}</h1>
          <p style={defaultSubtitleStyle}>{subtitle}</p>
        </div>

        {authError && (
          <div style={defaultErrorStyle}>
            [ERROR] {authError}
          </div>
        )}

        <p style={defaultDescStyle}>
          Connect to the central KBS Cloud SSO directory to authorize secure terminal commands.
        </p>

        <button 
          onClick={onLoginClick} 
          style={buttonClassName ? undefined : defaultButtonStyle}
          className={buttonClassName}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {buttonText}
        </button>

        <div style={defaultToggleStyle}>
          <label style={defaultLabelStyle}>
            <input 
              type="checkbox" 
              checked={!playOnline} 
              onChange={() => onPlayOnlineChange(!playOnline)} 
              style={defaultCheckboxStyle}
            />
            PLAY OFFLINE / LOCAL MODE
          </label>
        </div>
      </div>
    </div>
  );
};
