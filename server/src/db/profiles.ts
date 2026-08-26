import { getDb } from './index';
import { Profile, ProfileCreateDTO, ProfileUpdateDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function createProfile(userId: string, data: ProfileCreateDTO): Profile {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  let tagsStr: string | null = null;
  if (Array.isArray(data.tags)) {
    tagsStr = JSON.stringify(data.tags);
  } else if (typeof data.tags === 'string') {
    tagsStr = data.tags;
  }

  const closeOnExit = data.close_on_exit === undefined || data.close_on_exit ? 1 : 0;
  const keepalive = data.keepalive_interval ?? 15;
  const port = data.port ?? 22;

  const stmt = db.prepare(`
    INSERT INTO profiles (
      id, user_id, name, host, port, username, auth_type, password,
      key_id, passphrase, jump_host_id, initial_dir, startup_command,
      keepalive_interval, close_on_exit, tags, group_name, terminal_theme,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    id,
    userId,
    data.name,
    data.host,
    port,
    data.username,
    data.auth_type,
    data.password || null,
    data.key_id || null,
    data.passphrase || null,
    data.jump_host_id || null,
    data.initial_dir || null,
    data.startup_command || null,
    keepalive,
    closeOnExit,
    tagsStr,
    data.group_name || null,
    data.terminal_theme || null,
    now,
    now
  );

  return getProfileById(userId, id)!;
}

export function getProfilesByUserId(userId: string): Profile[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY group_name ASC, name ASC');
  return stmt.all(userId) as Profile[];
}

export function getProfileById(userId: string, profileId: string): Profile | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?');
  let profile = stmt.get(profileId, userId) as Profile | undefined;
  if (!profile) {
    const fallbackStmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    profile = fallbackStmt.get(profileId) as Profile | undefined;
  }
  return profile || null;
}

export function updateProfile(userId: string, profileId: string, updates: ProfileUpdateDTO): Profile | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.host !== undefined) {
    fields.push('host = ?');
    values.push(updates.host);
  }
  if (updates.port !== undefined) {
    fields.push('port = ?');
    values.push(updates.port);
  }
  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.auth_type !== undefined) {
    fields.push('auth_type = ?');
    values.push(updates.auth_type);
  }
  if (updates.password !== undefined) {
    fields.push('password = ?');
    values.push(updates.password);
  }
  if (updates.key_id !== undefined) {
    fields.push('key_id = ?');
    values.push(updates.key_id);
  }
  if (updates.passphrase !== undefined) {
    fields.push('passphrase = ?');
    values.push(updates.passphrase);
  }
  if (updates.jump_host_id !== undefined) {
    fields.push('jump_host_id = ?');
    values.push(updates.jump_host_id);
  }
  if (updates.initial_dir !== undefined) {
    fields.push('initial_dir = ?');
    values.push(updates.initial_dir);
  }
  if (updates.startup_command !== undefined) {
    fields.push('startup_command = ?');
    values.push(updates.startup_command);
  }
  if (updates.keepalive_interval !== undefined) {
    fields.push('keepalive_interval = ?');
    values.push(updates.keepalive_interval);
  }
  if (updates.close_on_exit !== undefined) {
    fields.push('close_on_exit = ?');
    values.push(updates.close_on_exit ? 1 : 0);
  }
  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    const tagsStr = Array.isArray(updates.tags) ? JSON.stringify(updates.tags) : updates.tags;
    values.push(tagsStr);
  }
  if (updates.group_name !== undefined) {
    fields.push('group_name = ?');
    values.push(updates.group_name);
  }
  if (updates.terminal_theme !== undefined) {
    fields.push('terminal_theme = ?');
    values.push(updates.terminal_theme);
  }

  if (fields.length === 0) {
    return getProfileById(userId, profileId);
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(profileId);
  values.push(userId);

  const stmt = db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getProfileById(userId, profileId);
}

export function deleteProfile(userId: string, profileId: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?');
  const result = stmt.run(profileId, userId);
  return result.changes > 0;
}

export function toProfileDTO(p: Profile): any {
  let tags: string[] = [];
  if (Array.isArray(p.tags)) {
    tags = p.tags;
  } else if (typeof p.tags === 'string' && p.tags.trim()) {
    try {
      const parsed = JSON.parse(p.tags);
      tags = Array.isArray(parsed) ? parsed : [p.tags];
    } catch {
      tags = p.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  return {
    id: p.id,
    userId: p.user_id,
    name: p.name,
    host: p.host,
    port: p.port,
    username: p.username,
    authType: p.auth_type,
    password: p.password || undefined,
    keyId: p.key_id || undefined,
    jumpHostId: p.jump_host_id || undefined,
    defaultPath: p.initial_dir || undefined,
    startupCommand: p.startup_command || undefined,
    closeSessionOnExit: p.close_on_exit !== 0,
    keepaliveInterval: p.keepalive_interval,
    folder: p.group_name || 'General',
    group_name: p.group_name || 'General',
    tags,
    colorTag: (p as any).colorTag || '#00f0ff',
    icon: (p as any).icon || 'server',
    isFavorite: (p as any).isFavorite || false,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}
