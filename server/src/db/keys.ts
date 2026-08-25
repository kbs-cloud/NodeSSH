import { getDb } from './index';
import { SSHKey, SSHKeyDTO, KeyType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function toSSHKeyDTO(key: SSHKey): SSHKeyDTO {
  return {
    id: key.id,
    name: key.name,
    public_key: key.public_key,
    key_type: key.key_type,
    fingerprint: key.fingerprint,
    created_at: key.created_at,
  };
}

export function createSSHKey(userId: string, data: {
  name: string;
  public_key: string;
  encrypted_private_key: string;
  key_type?: KeyType;
  fingerprint: string;
}): SSHKey {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const keyType = data.key_type || 'ed25519';

  const stmt = db.prepare(`
    INSERT INTO ssh_keys (id, user_id, name, public_key, encrypted_private_key, key_type, fingerprint, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    userId,
    data.name,
    data.public_key,
    data.encrypted_private_key,
    keyType,
    data.fingerprint,
    now
  );

  return getKeyById(userId, id)!;
}

export function getKeysByUserId(userId: string): SSHKey[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ssh_keys WHERE user_id = ? ORDER BY created_at DESC');
  return stmt.all(userId) as SSHKey[];
}

export function getKeyById(userId: string, keyId: string): SSHKey | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ssh_keys WHERE id = ? AND user_id = ?');
  const key = stmt.get(keyId, userId) as SSHKey | undefined;
  return key || null;
}

export function deleteSSHKey(userId: string, keyId: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM ssh_keys WHERE id = ? AND user_id = ?');
  const result = stmt.run(keyId, userId);
  return result.changes > 0;
}
