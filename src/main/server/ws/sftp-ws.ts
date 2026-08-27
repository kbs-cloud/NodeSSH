import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { authenticateWsRequest } from '../auth/middleware';
import { openSFTPSession, sftpList, sftpStat, sftpReadFile, sftpWriteFile, sftpDelete, sftpMkdir, sftpRename, sftpChmod } from '../ssh/sftp-service';

export function setupSftpWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const auth = authenticateWsRequest(req);
    if (!auth) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Invalid or missing JWT token' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    let activeSession: any = null;

    ws.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        const { id, action, profileId, path: targetPath, content, mode, oldPath, newPath, isDirectory, recursive } = msg;

        const sendReply = (data: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ id, action, ...data }));
          }
        };

        if (action === 'connect') {
          if (activeSession) {
            activeSession.close();
            activeSession = null;
          }
          activeSession = await openSFTPSession({ userId: auth.userId, profileId });
          sendReply({ status: 'connected', message: 'SFTP session established' });
          return;
        }

        if (!activeSession) {
          if (!profileId) {
            sendReply({ status: 'error', message: 'Not connected and profileId not provided' });
            return;
          }
          activeSession = await openSFTPSession({ userId: auth.userId, profileId });
        }

        switch (action) {
          case 'list': {
            const items = await sftpList(activeSession.sftp, targetPath || '/');
            sendReply({ status: 'success', path: targetPath || '/', items });
            break;
          }
          case 'stat': {
            const stat = await sftpStat(activeSession.sftp, targetPath);
            sendReply({ status: 'success', path: targetPath, stat });
            break;
          }
          case 'read': {
            const fileContent = await sftpReadFile(activeSession.sftp, targetPath);
            sendReply({ status: 'success', path: targetPath, content: fileContent });
            break;
          }
          case 'write': {
            await sftpWriteFile(activeSession.sftp, targetPath, content);
            sendReply({ status: 'success', path: targetPath, message: 'Saved' });
            break;
          }
          case 'mkdir': {
            await sftpMkdir(activeSession.sftp, targetPath, recursive !== false);
            sendReply({ status: 'success', path: targetPath, message: 'Directory created' });
            break;
          }
          case 'delete': {
            await sftpDelete(activeSession.sftp, targetPath, Boolean(isDirectory));
            sendReply({ status: 'success', path: targetPath, message: 'Deleted' });
            break;
          }
          case 'rename': {
            await sftpRename(activeSession.sftp, oldPath, newPath);
            sendReply({ status: 'success', oldPath, newPath, message: 'Renamed' });
            break;
          }
          case 'chmod': {
            await sftpChmod(activeSession.sftp, targetPath, mode);
            sendReply({ status: 'success', path: targetPath, message: 'Permissions updated' });
            break;
          }
          case 'ping': {
            sendReply({ status: 'pong' });
            break;
          }
          default:
            sendReply({ status: 'error', message: `Unknown SFTP action: ${action}` });
        }
      } catch (err: any) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ status: 'error', message: err.message }));
        }
      }
    });

    const cleanup = () => {
      if (activeSession) {
        activeSession.close();
        activeSession = null;
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });
}
