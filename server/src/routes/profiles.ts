import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import {
  createProfile,
  getProfilesByUserId,
  getProfileById,
  updateProfile,
  deleteProfile,
} from '../db/profiles';
import { exportToMobaXtermIni, parseMobaXtermIni } from '../utils/ini-parser';
import { ProfileCreateDTO } from '../types';

const router = Router();

// Require authentication for all profile routes
router.use(requireAuth);

// List Profiles
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profiles = getProfilesByUserId(userId);
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Profiles (JSON or MobaXterm .ini)
router.get('/export', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const format = (req.query.format as string) || 'json';
    const profiles = getProfilesByUserId(userId);

    if (format === 'ini' || format === 'mxtsessions') {
      const iniData = exportToMobaXtermIni(profiles);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="nodessh-mobaxterm-export.ini"');
      res.send(iniData);
      return;
    }

    // Default JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="nodessh-profiles.json"');
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import Profiles (JSON or MobaXterm .ini)
router.post('/import', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { format, content, profiles: profileArray } = req.body;

    let toImport: ProfileCreateDTO[] = [];

    if (format === 'ini' && typeof content === 'string') {
      toImport = parseMobaXtermIni(content);
    } else if (Array.isArray(profileArray)) {
      toImport = profileArray;
    } else if (typeof content === 'string') {
      // Try JSON first, fallback to INI
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          toImport = parsed;
        } else {
          toImport = parseMobaXtermIni(content);
        }
      } catch {
        toImport = parseMobaXtermIni(content);
      }
    }

    const createdProfiles = [];
    for (const item of toImport) {
      if (item.name && item.host && item.username) {
        const created = createProfile(userId, {
          name: item.name,
          host: item.host,
          port: item.port || 22,
          username: item.username,
          auth_type: item.auth_type || 'password',
          group_name: item.group_name,
          initial_dir: item.initial_dir,
          startup_command: item.startup_command,
          keepalive_interval: item.keepalive_interval ?? 15,
          close_on_exit: item.close_on_exit ?? true,
          tags: item.tags,
          terminal_theme: item.terminal_theme,
        });
        createdProfiles.push(created);
      }
    }

    res.json({
      message: `Successfully imported ${createdProfiles.length} profiles`,
      count: createdProfiles.length,
      profiles: createdProfiles,
    });
  } catch (err: any) {
    res.status(400).json({ error: `Import failed: ${err.message}` });
  }
});

// Get Profile by ID
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = getProfileById(userId, req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Profile
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, host, port, username, auth_type } = req.body;

    if (!name || !host || !username) {
      res.status(400).json({ error: 'Name, Host, and Username are required' });
      return;
    }

    const profile = createProfile(userId, req.body);
    res.status(201).json(profile);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update Profile
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updated = updateProfile(userId, req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Profile
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const success = deleteProfile(userId, req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ message: 'Profile deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
