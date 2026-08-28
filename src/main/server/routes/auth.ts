import { Router, Request, Response } from 'express';
import { registerLocalUser, loginLocalUser } from '../auth/local';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { findUserById, toUserDTO } from '../db/users';
import { getSettingsByUserId, upsertSettings } from '../db/settings';

const router = Router();

// Local Registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;
    const result = await registerLocalUser(username, password, email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Local Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await loginLocalUser(username, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Login failed' });
  }
});

// Current User Profile & Preferences
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = findUserById(userId);
    const preferences = getSettingsByUserId(userId);

    if (!user) {
      res.json({
        user: {
          id: userId,
          username: req.user?.username || 'admin',
          email: req.user?.email || 'admin@nodessh.local',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        preferences,
      });
      return;
    }

    res.json({
      user: toUserDTO(user),
      preferences,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Preferences
router.put('/preferences', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const preferences = req.body;
    const saved = upsertSettings(userId, preferences);
    res.json({ preferences: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
