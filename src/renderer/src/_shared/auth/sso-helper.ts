export function getAuthServerUrl(): string {
  const authProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    const port = window.location.port;
    if (port.startsWith('19') || port.startsWith('20')) {
      return 'http://localhost:19001';
    }
    return 'http://localhost:28001';
  }
  return `${authProto}//auth.kbs-cloud.com`;
}

export interface BackgroundCheckOptions {
  clientId: string;
  onSuccess: () => void;
  onFinished?: () => void;
}

export function startSSOBackgroundCheck({
  clientId,
  onSuccess,
  onFinished
}: BackgroundCheckOptions): () => void {
  if (typeof window === 'undefined') return () => {};

  const isPackaged = window.location.protocol === 'file:' || 
                     window.location.hostname === '' ||
                     navigator.userAgent.toLowerCase().includes('electron');
  
  if (isPackaged) {
    if (onFinished) onFinished();
    return () => {};
  }

  const localBackend = window.location.origin;
  const redirectUri = `${localBackend}/api/auth/callback?source=iframe`;
  const authorizeUrl = `${getAuthServerUrl()}/api/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  const iframe = document.createElement('iframe');
  iframe.src = authorizeUrl;
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  let cleanedUp = false;
  
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener('message', handleMessage);
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    if (onFinished) onFinished();
  };

  const timeoutId = setTimeout(() => {
    cleanup();
  }, 3000);

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'SSO_LOGIN_SUCCESS') {
      clearTimeout(timeoutId);
      cleanup();
      onSuccess();
    }
  };

  window.addEventListener('message', handleMessage);
  
  return cleanup;
}

export function getBackendPort(clientId: string): number {
  switch (clientId) {
    case 'alchemist':
    case 'alchemists-crucible': return 29004;
    case 'starswarm': return 29002;
    case 'tickerclash': return 29003;
    case 'gridlock-neon': return 29005;
    case 'retrosweeper': return 20006;
    case 'sudoku-neon':
    case 'sudoku': return 20007;
    case 'baseball':
    case 'baseball-stats': return 19008;
    case 'wyrdmarch': return 20009;
    case 'craft-realm': return 19010;
    case 'nodessh': return 3001;
    default: return 3001;
  }
}

export function redirectToSSO(clientId: string, state?: string): void {
  if (typeof window === 'undefined') return;

  const isPackaged = window.location.protocol === 'file:' || 
                     window.location.hostname === '' ||
                     navigator.userAgent.toLowerCase().includes('electron');
  
  const localBackend = isPackaged ? `http://localhost:${getBackendPort(clientId)}` : window.location.origin;
  const redirectUri = `${localBackend}/api/auth/callback`;
  
  let targetUrl = `${getAuthServerUrl()}/api/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  if (isPackaged && state) {
    targetUrl += `&state=${encodeURIComponent(state)}`;
    window.open(targetUrl, '_blank');
  } else {
    window.location.href = targetUrl;
  }
}

export function getHubUrl(): string {
  if (typeof window === 'undefined') return '/';
  
  const isPackaged = window.location.protocol === 'file:' || 
                     window.location.hostname === '' ||
                     navigator.userAgent.toLowerCase().includes('electron');
  
  if (isPackaged) {
    return 'http://localhost:19000';
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = window.location.port;
    if (port.startsWith('19') || port.startsWith('20')) {
      return 'http://localhost:19000';
    }
    return 'http://localhost:28000';
  }
  
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${proto}//kbs-cloud.com`;
}
