import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import {
  createProfile,
  getProfilesByUserId,
  getProfileById,
  updateProfile,
  deleteProfile,
  toProfileDTO,
} from '../db/profiles';
import { exportToMobaXtermIni, parseMobaXtermIni } from '../utils/ini-parser';
import { ProfileCreateDTO } from '../types';

const router = Router();

// Require authentication for all profile routes
router.use(requireAuth);

function normalizeProfileInput(body: any): ProfileCreateDTO {
  return {
    name: (body.name || '').trim() || 'Unnamed Server',
    host: (body.host || '').trim() || '127.0.0.1',
    port: Number(body.port || 22),
    username: (body.username || '').trim() || 'root',
    auth_type: body.auth_type || body.authType || 'password',
    password: body.password || undefined,
    key_id: body.key_id || body.keyId || undefined,
    passphrase: body.passphrase || undefined,
    jump_host_id: body.jump_host_id || body.jumpHostId || undefined,
    initial_dir: body.initial_dir || body.defaultPath || undefined,
    startup_command: body.startup_command || body.startupCommand || undefined,
    keepalive_interval: body.keepalive_interval !== undefined ? Number(body.keepalive_interval) : body.keepaliveInterval !== undefined ? Number(body.keepaliveInterval) : 15,
    close_on_exit: body.close_on_exit !== undefined ? Boolean(body.close_on_exit) : body.closeSessionOnExit !== undefined ? Boolean(body.closeSessionOnExit) : true,
    group_name: body.group_name || body.folder || undefined,
    tags: body.tags || [],
    terminal_theme: body.terminal_theme || body.colorTag || body.terminalTheme || undefined,
  };
}

// List Profiles
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profiles = getProfilesByUserId(userId);
    res.json(profiles.map(toProfileDTO));
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
    res.json(profiles.map(toProfileDTO));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import Profiles (JSON or MobaXterm .ini)
router.post('/import', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { format, content, profiles: profileArray } = req.body;

    let toImport: any[] = [];

    if (format === 'ini' && typeof content === 'string') {
      toImport = parseMobaXtermIni(content);
    } else if (Array.isArray(profileArray)) {
      toImport = profileArray;
    } else if (typeof content === 'string') {
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
      const normalized = normalizeProfileInput(item);
      if (normalized.name && normalized.host && normalized.username) {
        const created = createProfile(userId, normalized);
        createdProfiles.push(toProfileDTO(created));
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
    res.json(toProfileDTO(profile));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Profile
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const normalized = normalizeProfileInput(req.body);

    if (!normalized.name || !normalized.host || !normalized.username) {
      res.status(400).json({ error: 'Name, Host, and Username are required' });
      return;
    }

    const profile = createProfile(userId, normalized);
    res.status(201).json(toProfileDTO(profile));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update Profile
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const normalized = normalizeProfileInput(req.body);
    const updated = updateProfile(userId, req.params.id, normalized);
    if (!updated) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(toProfileDTO(updated));
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
