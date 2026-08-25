import { getDb } from './index';
import { v4 as uuidv4 } from 'uuid';

export interface KnownHost {
  id: string;
  user_id: string;
  host: string;
  port: number;
  key_type: string;
  fingerprint: string;
  public_key?: string;
  created_at: string;
  updated_at: string;
}

export type HostKeyStatus = 'trusted' | 'new' | 'mismatch';

export interface HostKeyVerificationResult {
  status: HostKeyStatus;
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  storedFingerprint?: string;
  knownHostId?: string;
}

export function getKnownHostsByUserId(userId: string): KnownHost[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM known_hosts WHERE user_id = ? ORDER BY updated_at DESC');
  return stmt.all(userId) as KnownHost[];
}

export function findKnownHost(userId: string, host: string, port: number): KnownHost | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM known_hosts WHERE user_id = ? AND host = ? AND port = ?');
  const record = stmt.get(userId, host, port) as KnownHost | undefined;
  return record || null;
}

export function verifyHostKey(
  userId: string,
  host: string,
  port: number,
  keyType: string,
  fingerprint: string
): HostKeyVerificationResult {
  const existing = findKnownHost(userId, host, port);

  if (!existing) {
    return {
      status: 'new',
      host,
      port,
      keyType,
      fingerprint,
    };
  }

  if (existing.fingerprint === fingerprint) {
    // Update last seen
    const db = getDb();
    const updateStmt = db.prepare('UPDATE known_hosts SET updated_at = ? WHERE id = ?');
    updateStmt.run(new Date().toISOString(), existing.id);

    return {
      status: 'trusted',
      host,
      port,
      keyType,
      fingerprint,
      knownHostId: existing.id,
    };
  }

  // Fingerprint changed! Potential MITM
  return {
    status: 'mismatch',
    host,
    port,
    keyType,
    fingerprint,
    storedFingerprint: existing.fingerprint,
    knownHostId: existing.id,
  };
}

export function trustHostKey(data: {
  userId: string;
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  publicKey?: string;
}): KnownHost {
  const db = getDb();
  const existing = findKnownHost(data.userId, data.host, data.port);
  const now = new Date().toISOString();

  if (existing) {
    const stmt = db.prepare(`
      UPDATE known_hosts 
      SET key_type = ?, fingerprint = ?, public_key = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(data.keyType, data.fingerprint, data.publicKey || null, now, existing.id);
    return findKnownHost(data.userId, data.host, data.port)!;
  }

  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO known_hosts (id, user_id, host, port, key_type, fingerprint, public_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.userId,
    data.host,
    data.port,
    data.keyType,
    data.fingerprint,
    data.publicKey || null,
    now,
    now
  );

  return findKnownHost(data.userId, data.host, data.port)!;
}

export function deleteKnownHost(userId: string, id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM known_hosts WHERE id = ? AND user_id = ?');
  const result = stmt.run(id, userId);
  return result.changes > 0;
}
