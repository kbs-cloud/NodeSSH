import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { getProfilesByUserId } from '../db/profiles';
import {
  openSFTPSession,
  sftpList,
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
} from '../ssh/sftp-service';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// Active transfer tracking
export const activeTransfers = new Map<string, { abort: () => void; startTime: number }>();

router.use(requireAuth);

function resolveProfileId(userId: string, requestedId?: string): string {
  if (requestedId && requestedId.trim()) return requestedId.trim();
  const profiles = getProfilesByUserId(userId);
  if (profiles.length > 0) return profiles[0].id;
  throw new Error('No SSH profile available for SFTP session. Please configure a Server Profile first.');
}

// List directory contents
router.get('/list', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.query.profileId as string);
    const remotePath = (req.query.path as string) || '/';

    session = await openSFTPSession({ userId, profileId });
    const list = await sftpList(session.sftp, remotePath);
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.query.profileId as string);
    const remotePath = req.query.path as string;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.query.profileId as string);
    const remotePath = req.query.path as string;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const { path: remotePath, content } = req.body;

    if (!remotePath || content === undefined) {
      res.status(400).json({ error: 'path and content are required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const { path: remotePath, recursive } = req.body;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const { path: remotePath, isDirectory } = req.body;

    if (!remotePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const { oldPath, newPath } = req.body;

    if (!oldPath || !newPath) {
      res.status(400).json({ error: 'oldPath and newPath are required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const { path: remotePath, mode } = req.body;

    if (!remotePath || mode === undefined) {
      res.status(400).json({ error: 'path and mode are required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const remoteDir = req.body.remoteDir || '/';
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    const filename = req.body.filename || file.originalname;
    const remotePath = `${remoteDir.replace(/\/+$/, '')}/${filename}`;

    session = await openSFTPSession({ userId, profileId });
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

  activeTransfers.set(transferId, {
    abort: () => {
      abortController.abort();
      cleanup();
    },
    startTime: Date.now(),
  });

  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
    cleanup();
  });

  try {
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.query.profileId as string);
    const remotePath = req.query.path as string;

    if (!remotePath) {
      cleanup();
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
    const stat = await sftpStat(session.sftp, remotePath);
    const cleanPath = remotePath.replace(/\\/g, '/');
    const basename = path.posix.basename(cleanPath) || 'download';

    if (stat.isDirectory) {
      // Directory download -> Stream as ZIP archive
      const zipFilename = `${basename}.zip`;
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('X-Transfer-Id', transferId);

      await sftpStreamDirectoryAsZip(session.sftp, remotePath, res, {
        signal: abortController.signal,
      });
      cleanup();
    } else {
      // Single file download -> Stream raw bytes
      res.setHeader('Content-Disposition', `attachment; filename="${basename}"; filename*=UTF-8''${encodeURIComponent(basename)}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('X-Transfer-Id', transferId);

      const stream = session.sftp.createReadStream(remotePath);

      const onAbort = () => {
        try { stream.destroy(); } catch {}
      };
      abortController.signal.addEventListener('abort', onAbort, { once: true });

      stream.on('error', (err: any) => {
        abortController.signal.removeEventListener('abort', onAbort);
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

// Remote extraction of archives
router.post('/extract', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const archivePath = req.body.path || req.body.archivePath;
    const destinationDir = req.body.destinationDir || req.body.targetDir;

    if (!archivePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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
    const userId = req.user!.userId;
    const profileId = resolveProfileId(userId, req.body.profileId);
    const sourcePaths = req.body.paths || req.body.sourcePaths;
    const targetArchive = req.body.targetArchive;

    if (!sourcePaths || !Array.isArray(sourcePaths) || sourcePaths.length === 0 || !targetArchive) {
      res.status(400).json({ error: 'paths array and targetArchive are required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
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

export default router;
