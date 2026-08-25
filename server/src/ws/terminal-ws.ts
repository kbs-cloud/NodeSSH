import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { authenticateWsRequest } from '../auth/middleware';
import { TerminalSession } from '../ssh/pty-streamer';
import { WSTerminalClientMessage } from '../types';

export function setupTerminalWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const auth = authenticateWsRequest(req);
    if (!auth) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Invalid or missing JWT token' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    const session = new TerminalSession(ws, auth.userId);

    ws.on('message', async (rawMessage: Buffer | string) => {
      try {
        const text = rawMessage.toString();
        const msg = JSON.parse(text) as WSTerminalClientMessage;

        if (msg.type === 'init') {
          await session.initialize(msg);
        } else {
          session.handleMessage(msg);
        }
      } catch (err: any) {
        try {
          ws.send(JSON.stringify({ type: 'error', message: `Invalid message format: ${err.message}` }));
        } catch {
          // Ignore
        }
      }
    });

    ws.on('close', () => {
      session.handleClose();
    });

    ws.on('error', (err) => {
      console.error('[TerminalWS] Socket error:', err.message);
      session.handleClose();
    });
  });
}
