import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
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
} from '../ssh/sftp-service';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

router.use(requireAuth);

// List directory contents
router.get('/list', async (req: AuthenticatedRequest, res: Response) => {
  let session;
  try {
    const userId = req.user!.userId;
    const profileId = req.query.profileId as string;
    const remotePath = (req.query.path as string) || '/';

    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }

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
    const profileId = req.query.profileId as string;
    const remotePath = req.query.path as string;

    if (!profileId || !remotePath) {
      res.status(400).json({ error: 'profileId and path are required' });
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
    const profileId = req.query.profileId as string;
    const remotePath = req.query.path as string;

    if (!profileId || !remotePath) {
      res.status(400).json({ error: 'profileId and path are required' });
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
    const { profileId, path: remotePath, content } = req.body;

    if (!profileId || !remotePath || content === undefined) {
      res.status(400).json({ error: 'profileId, path, and content are required' });
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
    const { profileId, path: remotePath, recursive } = req.body;

    if (!profileId || !remotePath) {
      res.status(400).json({ error: 'profileId and path are required' });
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
    const { profileId, path: remotePath, isDirectory } = req.body;

    if (!profileId || !remotePath) {
      res.status(400).json({ error: 'profileId and path are required' });
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
    const { profileId, oldPath, newPath } = req.body;

    if (!profileId || !oldPath || !newPath) {
      res.status(400).json({ error: 'profileId, oldPath, and newPath are required' });
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
    const { profileId, path: remotePath, mode } = req.body;

    if (!profileId || !remotePath || mode === undefined) {
      res.status(400).json({ error: 'profileId, path, and mode are required' });
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
    const profileId = req.body.profileId;
    const remoteDir = req.body.remoteDir || '/';
    const file = req.file;

    if (!profileId || !file) {
      res.status(400).json({ error: 'profileId and file are required' });
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

// Download file
router.get('/download', async (req: AuthenticatedRequest, res: Response) => {
  let session: any;
  try {
    const userId = req.user!.userId;
    const profileId = req.query.profileId as string;
    const remotePath = req.query.path as string;

    if (!profileId || !remotePath) {
      res.status(400).json({ error: 'profileId and path are required' });
      return;
    }

    session = await openSFTPSession({ userId, profileId });
    const filename = path.basename(remotePath);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
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
  } catch (err: any) {
    if (session) session.close();
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
