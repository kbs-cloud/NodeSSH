import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import {
  createSnippet,
  getSnippetsByUserId,
  getSnippetById,
  updateSnippet,
  deleteSnippet,
} from '../db/snippets';

const router = Router();

router.use(requireAuth);

// List Snippets
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const snippets = getSnippetsByUserId(userId);
    res.json(snippets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Snippet
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { title, command } = req.body;

    if (!title || !command) {
      res.status(400).json({ error: 'Title and Command are required' });
      return;
    }

    const snippet = createSnippet(userId, req.body);
    res.status(201).json(snippet);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get Snippet by ID
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const snippet = getSnippetById(userId, req.params.id);
    if (!snippet) {
      res.status(404).json({ error: 'Snippet not found' });
      return;
    }
    res.json(snippet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Snippet
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updated = updateSnippet(userId, req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Snippet not found' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Snippet
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const success = deleteSnippet(userId, req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Snippet not found' });
      return;
    }
    res.json({ message: 'Snippet deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
