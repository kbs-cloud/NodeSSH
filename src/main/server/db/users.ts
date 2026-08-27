import { getDb } from './index';
import { User, UserDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    sso_id: user.sso_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function createUser(data: {
  username: string;
  password_hash?: string | null;
  email?: string | null;
  sso_id?: string | null;
}): User {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, email, sso_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.username,
    data.password_hash || null,
    data.email || null,
    data.sso_id || null,
    now,
    now
  );

  return findUserById(id)!;
}

export function findUserById(id: string): User | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(id) as User | undefined;
  return user || null;
}

export function findUserByUsername(username: string): User | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
  const user = stmt.get(username) as User | undefined;
  return user || null;
}

export function findUserBySsoId(ssoId: string): User | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE sso_id = ?');
  const user = stmt.get(ssoId) as User | undefined;
  return user || null;
}

export function findUserByEmail(email: string): User | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
  const user = stmt.get(email) as User | undefined;
  return user || null;
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.password_hash !== undefined) {
    fields.push('password_hash = ?');
    values.push(updates.password_hash);
  }
  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email);
  }
  if (updates.sso_id !== undefined) {
    fields.push('sso_id = ?');
    values.push(updates.sso_id);
  }

  if (fields.length === 0) {
    return findUserById(id);
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return findUserById(id);
}
