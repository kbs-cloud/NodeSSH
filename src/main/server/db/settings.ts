import { getDb } from './index';
import { UserSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function getSettingsByUserId(userId: string): Record<string, any> {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM settings WHERE user_id = ?');
  const record = stmt.get(userId) as UserSettings | undefined;
  if (!record || !record.preferences_json) {
    return {};
  }
  try {
    return JSON.parse(record.preferences_json);
  } catch {
    return {};
  }
}

export function upsertSettings(userId: string, preferences: Record<string, any>): Record<string, any> {
  const db = getDb();
  const now = new Date().toISOString();
  const preferencesJson = JSON.stringify(preferences);

  const existing = db.prepare('SELECT id FROM settings WHERE user_id = ?').get(userId) as { id: string } | undefined;

  if (existing) {
    db.prepare('UPDATE settings SET preferences_json = ?, updated_at = ? WHERE user_id = ?')
      .run(preferencesJson, now, userId);
  } else {
    const id = uuidv4();
    db.prepare('INSERT INTO settings (id, user_id, preferences_json, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, userId, preferencesJson, now);
  }

  return preferences;
}
