import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { getProfileById, getProfilesByUserId } from '../db/profiles';
import { SSHConnectionOptions } from '../ssh/connection';
import {
  openSFTPSession,
  sftpList,
  sftpRealPath,
  sftpStat,
  sftpReadFile,
  sftpWriteFile,
  sftpMkdir,
  sftpDelete,
  sftpRename,
  sftpChmod,
  sftpStreamDirectoryAsZip,
  sftpRemoteExtract,
  sftpRemoteCompress,
  sftpTransferBetweenSessions,
  sftpTransferLocalToRemote,
  sftpDownloadFileDirect,
  sftpDownloadDirectoryDirect,
} from '../ssh/sftp-service';
import path from 'path';
import fs from 'fs';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// Active transfer tracking
export interface ActiveTransferEntry {
  transferId: string;
  type: 'download' | 'upload';
  isFolder: boolean;
  path: string;
  filename: string;
  startTime: number;
  status: 'active' | 'completed' | 'aborted' | 'error';
  currentFile?: string;
  exploredFiles?: number;
  exploredDirs?: number;
  processedFiles?: number;
  processedBytes?: number;
  totalBytes?: number;
  percent?: number;
  abort: () => void;
}

export const activeTransfers = new Map<string, ActiveTransferEntry>();

router.use(requireAuth);

function extractSSHOptions(req: AuthenticatedRequest): SSHConnectionOptions {
  const userId = req.user!.userId;
  const src = req.method === 'GET' ? req.query : req.body;

  const profileId = (src.profileId as string)?.trim() || undefined;
  const host = (src.host as string)?.trim() || undefined;
  const port = src.port ? Number(src.port) : undefined;
  const username = (src.username as string)?.trim() || undefined;
  const password = (src.password as string) || undefined;
  const keyId = (src.keyId as string)?.trim() || undefined;
  const privateKey = (src.privateKey as string) || undefined;
  const passphrase = (src.passphrase as string) || undefined;
  const jumpHostId = (src.jumpHostId as string)?.trim() || undefined;
  const sftpCommand = (src.sftpCommand as string)?.trim() || undefined;

  let resolvedProfileId = profileId;
  if (profileId) {
    const existing = getProfileById(userId, profileId);
    if (existing) {
      resolvedProfileId = existing.id;
    }
  }

  // Fallback to first available profile in DB if neither profileId nor host was provided
  if (!resolvedProfileId && !host) {
    const userProfiles = getProfilesByUserId(userId);
    if (userProfiles.length > 0) {
      resolvedProfileId = userProfiles[0].id;
    }
  }

  if (!resolvedProfileId && !host) {
    throw new Error('No SSH profile or connection target specified for SFTP session. Please configure a Server Profile or connect to an SSH host first.');
  }

  return {
    userId,
    profileId: resolvedProfileId,
    host,
    port,
    username,
    password,
    keyId,
    privateKey,
    passphrase,
    jumpHostId,
    sftpCommand,
  };
}

// List directory contents
router.get('/list', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    let requestedPath = (req.query.path as string)?.trim();

    session = await openSFTPSession(sshOptions);

    let remotePath = requestedPath;
    if (!remotePath || remotePath === '.' || remotePath === '~') {
      remotePath = await sftpRealPath(session.sftp, '.');
    }

    let list;
    try {
      list = await sftpList(session.sftp, remotePath);
    } catch (err: any) {
      // If requested directory does not exist, resolve actual remote home directory
      const fallbackPath = await sftpRealPath(session.sftp, '.');
      if (fallbackPath && fallbackPath !== remotePath) {
        try {
          list = await sftpList(session.sftp, fallbackPath);
          remotePath = fallbackPath;
        } catch {
          list = await sftpList(session.sftp, '/');
          remotePath = '/';
        }
      } else {
        list = await sftpList(session.sftp, '/');
        remotePath = '/';
      }
    }

    res.json({
      path: remotePath,
      items: list,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Stat file or directory
router.get('/stat', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const remotePath = req.query.path as string;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    const stat = await sftpStat(session.sftp, remotePath);
    res.json(stat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Read text file content
router.get('/read', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const remotePath = req.query.path as string;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    const content = await sftpReadFile(session.sftp, remotePath);
    res.json({
      path: remotePath,
      content,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Write text file content
router.post('/write', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const { path: remotePath, content } = req.body;

    if (!remotePath || content === undefined) {
      res.status(400).json({ error: 'path and content are required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    await sftpWriteFile(session.sftp, remotePath, content);
    res.json({ message: 'File saved successfully', path: remotePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Create directory
router.post('/mkdir', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const { path: remotePath, recursive } = req.body;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    await sftpMkdir(session.sftp, remotePath, recursive !== false);
    res.json({ message: 'Directory created successfully', path: remotePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Delete file or directory
router.post('/delete', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const { path: remotePath, isDirectory } = req.body;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    await sftpDelete(session.sftp, remotePath, Boolean(isDirectory));
    res.json({ message: 'Deleted successfully', path: remotePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Rename file or directory
router.post('/rename', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const { oldPath, newPath } = req.body;

    if (!oldPath || !newPath) {
      res.status(400).json({ error: 'oldPath and newPath are required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    await sftpRename(session.sftp, oldPath, newPath);
    res.json({ message: 'Renamed successfully', oldPath, newPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Chmod permissions
router.post('/chmod', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const { path: remotePath, mode } = req.body;

    if (!remotePath || mode === undefined) {
      res.status(400).json({ error: 'path and mode are required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    await sftpChmod(session.sftp, remotePath, mode);
    res.json({ message: 'Permissions updated successfully', path: remotePath, mode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Upload file
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const remoteDir = req.body.remoteDir || '/';
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    const filename = req.body.filename || file.originalname;
    const remotePath = `${remoteDir.replace(/\/+$/, '')}/${filename}`;

    session = await openSFTPSession(sshOptions);
    await sftpWriteFile(session.sftp, remotePath, file.buffer);

    res.json({
      message: 'File uploaded successfully',
      filename,
      remotePath,
      size: file.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Download file or entire directory as ZIP
router.get('/download', async (req: AuthenticatedRequest, res: Response) => {
  let session: any;
  const transferId = (req.query.transferId as string) || uuidv4();
  const abortController = new AbortController();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    activeTransfers.delete(transferId);
    if (session) {
      session.close();
      session = null;
    }
  };

  const remotePath = (req.query.path as string) || '';
  const cleanPath = remotePath.replace(/\\/g, '/');
  const basename = path.posix.basename(cleanPath) || 'download';

  const transferEntry: ActiveTransferEntry = {
    transferId,
    type: 'download',
    isFolder: false,
    path: remotePath,
    filename: basename,
    startTime: Date.now(),
    status: 'active',
    exploredFiles: 0,
    exploredDirs: 0,
    processedFiles: 0,
    processedBytes: 0,
    totalBytes: 0,
    percent: 0,
    abort: () => {
      transferEntry.status = 'aborted';
      abortController.abort();
      cleanup();
    },
  };

  activeTransfers.set(transferId, transferEntry);

  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
    cleanup();
  });

  try {
    const sshOptions = extractSSHOptions(req);

    if (!remotePath) {
      cleanup();
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    const stat = await sftpStat(session.sftp, remotePath);

    if (stat.isDirectory) {
      // Directory download -> Stream as ZIP archive
      const zipFilename = `${basename}.zip`;
      transferEntry.isFolder = true;
      transferEntry.filename = zipFilename;
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('X-Transfer-Id', transferId);

      await sftpStreamDirectoryAsZip(session.sftp, remotePath, res, {
        signal: abortController.signal,
        onProgress: (prog) => {
          transferEntry.currentFile = prog.currentFile;
          transferEntry.exploredFiles = prog.exploredFiles;
          transferEntry.exploredDirs = prog.exploredDirs;
          transferEntry.processedFiles = prog.processedFiles;
          transferEntry.processedBytes = prog.processedBytes;
          transferEntry.totalBytes = prog.totalDiscoveredBytes;
          transferEntry.percent = prog.percent;
          if (prog.phase === 'completed') transferEntry.status = 'completed';
          if (prog.phase === 'aborted') transferEntry.status = 'aborted';
        },
      });
      transferEntry.status = 'completed';
      transferEntry.percent = 100;
      cleanup();
    } else {
      // Single file download -> Stream raw bytes
      transferEntry.isFolder = false;
      transferEntry.totalBytes = stat.size || 0;
      transferEntry.exploredFiles = 1;
      transferEntry.currentFile = basename;

      res.setHeader('Content-Disposition', `attachment; filename="${basename}"; filename*=UTF-8''${encodeURIComponent(basename)}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('X-Transfer-Id', transferId);

      const stream = session.sftp.createReadStream(remotePath);

      const onAbort = () => {
        try { stream.destroy(); } catch {}
      };
      abortController.signal.addEventListener('abort', onAbort, { once: true });

      stream.on('data', (chunk: Buffer) => {
        transferEntry.processedBytes = (transferEntry.processedBytes || 0) + chunk.length;
        if (transferEntry.totalBytes && transferEntry.totalBytes > 0) {
          transferEntry.percent = Math.min(99, Math.round((transferEntry.processedBytes / transferEntry.totalBytes) * 100));
        }
      });

      stream.on('error', (err: any) => {
        abortController.signal.removeEventListener('abort', onAbort);
        transferEntry.status = 'error';
        cleanup();
        if (!res.headersSent) {
          res.status(500).json({ error: `Download error: ${err.message}` });
        }
      });

      stream.on('close', () => {
        abortController.signal.removeEventListener('abort', onAbort);
        cleanup();
      });

      stream.on('end', () => {
        abortController.signal.removeEventListener('abort', onAbort);
        transferEntry.status = 'completed';
        transferEntry.percent = 100;
        cleanup();
      });

      stream.pipe(res);
    }
  } catch (err: any) {
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Get active transfer status
router.get(['/transfer/status', '/transfer/status/:transferId'], async (req: AuthenticatedRequest, res: Response) => {
  const transferId = (req.params.transferId || req.query.transferId) as string;
  if (!transferId) {
    res.status(400).json({ error: 'transferId is required' });
    return;
  }

  const transfer = activeTransfers.get(transferId);
  if (!transfer) {
    res.status(404).json({ error: `Transfer '${transferId}' not found or already completed` });
    return;
  }

  res.json({
    transferId: transfer.transferId,
    type: transfer.type,
    isFolder: transfer.isFolder,
    path: transfer.path,
    filename: transfer.filename,
    startTime: transfer.startTime,
    status: transfer.status,
    currentFile: transfer.currentFile,
    exploredFiles: transfer.exploredFiles || 0,
    exploredDirs: transfer.exploredDirs || 0,
    processedFiles: transfer.processedFiles || 0,
    processedBytes: transfer.processedBytes || 0,
    totalBytes: transfer.totalBytes || 0,
    percent: transfer.percent || 0,
  });
});

// Remote extraction of archives
router.post('/extract', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const archivePath = req.body.path || req.body.archivePath;
    const destinationDir = req.body.destinationDir || req.body.targetDir;

    if (!archivePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    const result = await sftpRemoteExtract(session.sshConn, archivePath, destinationDir);
    res.json({
      message: `Successfully extracted ${path.posix.basename(archivePath)}`,
      path: archivePath,
      destinationDir: destinationDir || path.posix.dirname(archivePath),
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Remote compression
router.post('/compress', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const sshOptions = extractSSHOptions(req);
    const sourcePaths = req.body.paths || req.body.sourcePaths;
    const targetArchive = req.body.targetArchive;

    if (!sourcePaths || !Array.isArray(sourcePaths) || sourcePaths.length === 0 || !targetArchive) {
      res.status(400).json({ error: 'paths array and targetArchive are required' });
      return;
    }

    session = await openSFTPSession(sshOptions);
    const result = await sftpRemoteCompress(session.sshConn, sourcePaths, targetArchive);
    res.json({
      message: `Successfully compressed to ${path.posix.basename(targetArchive)}`,
      targetArchive,
      sourcePaths,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (session) session.close();
  }
});

// Abort active transfer
router.post('/transfer/abort', async (req: AuthenticatedRequest, res: Response) => {
  const { transferId } = req.body;
  if (!transferId) {
    res.status(400).json({ error: 'transferId is required' });
    return;
  }

  const transfer = activeTransfers.get(transferId);
  if (!transfer) {
    res.status(404).json({ error: `Transfer '${transferId}' not found or already completed` });
    return;
  }

  try {
    transfer.abort();
  } catch {}
  activeTransfers.delete(transferId);
  res.json({ success: true, message: 'Transfer aborted', transferId });
});

// Cross-session transfer endpoint (Remote-to-Remote, Local-to-Remote, Remote-to-Local, Local-to-Local)
router.post('/transfer-cross', async (req: AuthenticatedRequest, res: Response) => {
  const transferId = (req.body.transferId as string) || uuidv4();
  const abortController = new AbortController();
  const {
    sourceType, // 'local' | 'sftp'
    sourcePath,
    sourceTarget, // profile or connection params
    destType, // 'local' | 'sftp'
    destDir,
    destTarget, // profile or connection params
  } = req.body;

  if (!sourcePath || !destDir || !sourceType || !destType) {
    res.status(400).json({ error: 'sourcePath, destDir, sourceType, and destType are required' });
    return;
  }

  const baseName = path.basename(sourcePath.replace(/\\/g, '/'));
  let srcSession: any = null;
  let destSession: any = null;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    activeTransfers.delete(transferId);
    if (srcSession) {
      try { srcSession.close(); } catch {}
      srcSession = null;
    }
    if (destSession) {
      try { destSession.close(); } catch {}
      destSession = null;
    }
  };

  const transferEntry: ActiveTransferEntry = {
    transferId,
    type: destType === 'local' ? 'download' : 'upload',
    isFolder: false,
    path: sourcePath,
    filename: baseName,
    startTime: Date.now(),
    status: 'active',
    exploredFiles: 0,
    exploredDirs: 0,
    processedFiles: 0,
    processedBytes: 0,
    totalBytes: 0,
    percent: 0,
    abort: () => {
      transferEntry.status = 'aborted';
      abortController.abort();
    },
  };

  activeTransfers.set(transferId, transferEntry);

  const onProgress = (prog: any) => {
    transferEntry.currentFile = prog.currentFile;
    transferEntry.exploredFiles = prog.exploredFiles;
    transferEntry.exploredDirs = prog.exploredDirs;
    transferEntry.processedFiles = prog.processedFiles;
    transferEntry.processedBytes = prog.processedBytes;
    transferEntry.totalBytes = prog.totalDiscoveredBytes;
    transferEntry.percent = prog.percent;
    if (prog.phase === 'completed') transferEntry.status = 'completed';
    if (prog.phase === 'aborted') transferEntry.status = 'aborted';
  };

  try {
    const userId = req.user!.userId;

    function buildSSHOptions(t: any): SSHConnectionOptions {
      if (!t) throw new Error('Missing SSH connection target parameters');
      return {
        userId,
        profileId: typeof t === 'string' ? t : (t.id || t.profileId),
        host: t.host,
        port: t.port ? Number(t.port) : undefined,
        username: t.username,
        password: t.password,
        keyId: t.keyId || t.key_id,
        privateKey: t.privateKey,
        passphrase: t.passphrase,
        jumpHostId: t.jumpHostId || t.jump_host_id,
        sftpCommand: t.sftpCommand || t.sftp_command,
      };
    }

    if (sourceType === 'sftp' && destType === 'sftp') {
      // Remote SFTP -> Remote SFTP
      srcSession = await openSFTPSession(buildSSHOptions(sourceTarget));
      destSession = await openSFTPSession(buildSSHOptions(destTarget));
      await sftpTransferBetweenSessions(srcSession.sftp, sourcePath, destSession.sftp, destDir, {
        signal: abortController.signal,
        onProgress,
      });
    } else if (sourceType === 'local' && destType === 'sftp') {
      // Local -> Remote SFTP
      destSession = await openSFTPSession(buildSSHOptions(destTarget));
      await sftpTransferLocalToRemote(sourcePath, destSession.sftp, destDir, {
        signal: abortController.signal,
        onProgress,
      });
    } else if (sourceType === 'sftp' && destType === 'local') {
      // Remote SFTP -> Local
      srcSession = await openSFTPSession(buildSSHOptions(sourceTarget));
      const stat = await sftpStat(srcSession.sftp, sourcePath);
      const destResolvedDir = path.resolve(destDir);
      if (!fs.existsSync(destResolvedDir)) {
        fs.mkdirSync(destResolvedDir, { recursive: true });
      }
      const fullLocalDest = path.join(destResolvedDir, baseName);
      if (stat.isDirectory) {
        if (!fs.existsSync(fullLocalDest)) {
          fs.mkdirSync(fullLocalDest, { recursive: true });
        }
        await sftpDownloadDirectoryDirect(srcSession.sftp, sourcePath, fullLocalDest, {
          signal: abortController.signal,
          onProgress,
        });
      } else {
        const fileParent = path.dirname(fullLocalDest);
        if (!fs.existsSync(fileParent)) {
          fs.mkdirSync(fileParent, { recursive: true });
        }
        await sftpDownloadFileDirect(srcSession.sftp, sourcePath, fullLocalDest, {
          signal: abortController.signal,
          onProgress,
        });
      }
    } else if (sourceType === 'local' && destType === 'local') {
      // Local -> Local
      const srcResolved = path.resolve(sourcePath);
      const destResolvedDir = path.resolve(destDir);
      if (!fs.existsSync(destResolvedDir)) {
        fs.mkdirSync(destResolvedDir, { recursive: true });
      }
      const destResolved = path.join(destResolvedDir, baseName);
      const parentDir = path.dirname(destResolved);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.cpSync(srcResolved, destResolved, { recursive: true });
      transferEntry.percent = 100;
      transferEntry.status = 'completed';
    }

    transferEntry.status = 'completed';
    transferEntry.percent = 100;
    res.json({ success: true, message: `Transferred ${baseName} successfully`, transferId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    cleanup();
  }
});

export default router;
