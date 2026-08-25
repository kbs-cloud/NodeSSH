import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import {
  createSSHKey,
  getKeysByUserId,
  getKeyById,
  deleteSSHKey,
  toSSHKeyDTO,
} from '../db/keys';
import { generateSSHKeyPair, calculateFingerprint } from '../security/keygen';
import { encryptPrivateKey } from '../security/vault';
import { pushPublicKeyToHost } from '../security/ssh-copy-id';
import { KeyType } from '../types';

const router = Router();

router.use(requireAuth);

// List Keys for current user
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const keys = getKeysByUserId(userId);
    res.json(keys.map(toSSHKeyDTO));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate new SSH Keypair (Ed25519 or RSA 4096)
router.post('/generate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, key_type, bits, comment } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Key name is required' });
      return;
    }

    const keyType: KeyType = key_type === 'rsa' ? 'rsa' : 'ed25519';
    const keyComment = comment || `${name.trim().toLowerCase().replace(/\s+/g, '-')}-nodessh`;

    const generated = generateSSHKeyPair(keyType, bits || 4096, keyComment);
    const encryptedPriv = encryptPrivateKey(generated.privateKey);

    const saved = createSSHKey(userId, {
      name: name.trim(),
      public_key: generated.publicKey,
      encrypted_private_key: encryptedPriv,
      key_type: generated.keyType,
      fingerprint: generated.fingerprint,
    });

    res.status(201).json({
      key: toSSHKeyDTO(saved),
      publicKey: generated.publicKey,
      // Provide private key once during generation if requested for download
      privateKey: generated.privateKey,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Key generation failed: ${err.message}` });
  }
});

// Import existing key
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, public_key, private_key, key_type } = req.body;

    if (!name || !public_key || !private_key) {
      res.status(400).json({ error: 'Name, Public Key, and Private Key are required' });
      return;
    }

    const fingerprint = calculateFingerprint(public_key);
    const encryptedPriv = encryptPrivateKey(private_key);

    const saved = createSSHKey(userId, {
      name: name.trim(),
      public_key: public_key.trim(),
      encrypted_private_key: encryptedPriv,
      key_type: key_type || 'ed25519',
      fingerprint,
    });

    res.status(201).json(toSSHKeyDTO(saved));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get key by ID (public details)
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const key = getKeyById(userId, req.params.id);
    if (!key) {
      res.status(404).json({ error: 'SSH Key not found' });
      return;
    }
    res.json(toSSHKeyDTO(key));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete key
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const success = deleteSSHKey(userId, req.params.id);
    if (!success) {
      res.status(404).json({ error: 'SSH Key not found' });
      return;
    }
    res.json({ message: 'SSH Key deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Push public key to remote host (ssh-copy-id)
router.post('/push-to-server', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { key_id, public_key, host, port, username, password } = req.body;

    let targetPubKey = public_key;

    if (!targetPubKey && key_id) {
      const keyRecord = getKeyById(userId, key_id);
      if (keyRecord) {
        targetPubKey = keyRecord.public_key;
      }
    }

    if (!targetPubKey || !host || !username) {
      res.status(400).json({ error: 'Public Key, Host, and Username are required' });
      return;
    }

    const result = await pushPublicKeyToHost({
      host,
      port: port || 22,
      username,
      password,
      publicKey: targetPubKey,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to push key to server: ${err.message}` });
  }
});

export default router;
