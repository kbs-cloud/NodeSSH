import { Router, Response } from 'express';
import multer from 'multer';
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
} from '../ssh/sftp-service';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

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
    const basename = path.basename(remotePath) || 'download';

    if (stat.isDirectory) {
      // Directory download -> Stream as ZIP archive
      const zipFilename = `${basename}.zip`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);
      res.setHeader('Content-Type', 'application/zip');

      await sftpStreamDirectoryAsZip(session.sftp, remotePath, res);
      if (session) session.close();
    } else {
      // Single file download -> Stream raw bytes
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(basename)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const stream = session.sftp.createReadStream(remotePath);

      stream.on('error', (err: any) => {
        if (!res.headersSent) {
          res.status(500).json({ error: `Download error: ${err.message}` });
        }
        if (session) session.close();
      });

      stream.on('close', () => {
        if (session) session.close();
      });

      stream.pipe(res);
    }
  } catch (err: any) {
    if (session) session.close();
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
