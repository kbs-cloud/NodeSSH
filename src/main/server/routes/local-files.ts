import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

router.use(requireAuth);

/**
 * Gets available drive letters on Windows or root directory on Unix-like systems
 */
function getSystemDrives(): { name: string; path: string; isDrive: boolean }[] {
  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    const drives: { name: string; path: string; isDrive: boolean }[] = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < letters.length; i++) {
      const driveLetter = `${letters[i]}:\\`;
      try {
        if (fs.existsSync(driveLetter)) {
          drives.push({
            name: `${letters[i]}:`,
            path: driveLetter,
            isDrive: true,
          });
        }
      } catch {
        // Drive not available or optical/network drive without media
      }
    }
    if (drives.length === 0) {
      drives.push({ name: 'C:', path: 'C:\\', isDrive: true });
    }
    return drives;
  }
  return [{ name: '/', path: '/', isDrive: true }];
}

/**
 * Quick system locations for user convenience
 */
function getQuickLocations(): { name: string; path: string; icon?: string }[] {
  const home = os.homedir();
  const locations: { name: string; path: string; icon?: string }[] = [
    { name: 'Home', path: home, icon: 'home' },
  ];

  const desktop = path.join(home, 'Desktop');
  if (fs.existsSync(desktop)) locations.push({ name: 'Desktop', path: desktop, icon: 'monitor' });

  const downloads = path.join(home, 'Downloads');
  if (fs.existsSync(downloads)) locations.push({ name: 'Downloads', path: downloads, icon: 'download' });

  const documents = path.join(home, 'Documents');
  if (fs.existsSync(documents)) locations.push({ name: 'Documents', path: documents, icon: 'folder' });

  return locations;
}

// 1. Get system drives and quick locations
router.get('/drives', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const drives = getSystemDrives();
    const quickLocations = getQuickLocations();
    const homeDir = os.homedir();
    res.json({ drives, quickLocations, homeDir, platform: os.platform() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. List directory contents
router.get('/list', (req: AuthenticatedRequest, res: Response) => {
  try {
    let targetPath = (req.query.path as string)?.trim();
    if (!targetPath || targetPath === '~' || targetPath === '.') {
      targetPath = os.homedir();
    }

    // Normalize path
    targetPath = path.resolve(targetPath);

    if (!fs.existsSync(targetPath)) {
      // Fallback to home dir if target doesn't exist
      targetPath = os.homedir();
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = entries.map((entry) => {
      const fullPath = path.join(targetPath, entry.name);
      let size = 0;
      let modifyTime = Date.now();
      let permissions = '0644';
      let isDirectory = entry.isDirectory();
      let isSymbolicLink = entry.isSymbolicLink();

      try {
        const itemStat = fs.statSync(fullPath);
        size = itemStat.size;
        modifyTime = itemStat.mtimeMs;
        isDirectory = itemStat.isDirectory();
        permissions = '0' + (itemStat.mode & parseInt('777', 8)).toString(8);
      } catch {
        // Inaccessible file / broken symlink
      }

      return {
        name: entry.name,
        path: fullPath,
        type: isDirectory ? 'directory' : isSymbolicLink ? 'symlink' : 'file',
        size,
        modifyTime,
        permissions,
        owner: 'local',
      };
    });

    res.json({
      path: targetPath,
      items,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Read text file content
router.get('/read', (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: `File not found: ${filePath}` });
      return;
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    res.json({
      path: resolvedPath,
      content,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Write text file content
router.post('/write', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'path and content are required' });
      return;
    }
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content, 'utf8');
    res.json({ message: 'Local file saved successfully', path: resolvedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create directory
router.post('/mkdir', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const resolvedPath = path.resolve(dirPath);
    fs.mkdirSync(resolvedPath, { recursive: true });
    res.json({ message: 'Directory created successfully', path: resolvedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete file or directory
router.post('/delete', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path: targetPath, isDirectory } = req.body;
    if (!targetPath) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Path not found' });
      return;
    }

    if (isDirectory || fs.statSync(resolvedPath).isDirectory()) {
      fs.rmSync(resolvedPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolvedPath);
    }
    res.json({ message: 'Deleted successfully', path: resolvedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Rename / Move
router.post('/rename', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      res.status(400).json({ error: 'oldPath and newPath are required' });
      return;
    }
    const resolvedOld = path.resolve(oldPath);
    const resolvedNew = path.resolve(newPath);
    fs.renameSync(resolvedOld, resolvedNew);
    res.json({ message: 'Renamed successfully', oldPath: resolvedOld, newPath: resolvedNew });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Copy local file or directory
router.post('/copy', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { srcPath, destPath } = req.body;
    if (!srcPath || !destPath) {
      res.status(400).json({ error: 'srcPath and destPath are required' });
      return;
    }
    const resolvedSrc = path.resolve(srcPath);
    const resolvedDest = path.resolve(destPath);
    fs.cpSync(resolvedSrc, resolvedDest, { recursive: true });
    res.json({ message: 'Copied successfully', srcPath: resolvedSrc, destPath: resolvedDest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
