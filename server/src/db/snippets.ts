import { getDb } from './index';
import { Snippet, SnippetCreateDTO, SnippetUpdateDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function createSnippet(userId: string, data: SnippetCreateDTO): Snippet {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const category = data.category || 'General';

  const stmt = db.prepare(`
    INSERT INTO snippets (id, user_id, title, command, category, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    userId,
    data.title,
    data.command,
    category,
    data.description || null,
    now
  );

  return getSnippetById(userId, id)!;
}

export function getSnippetsByUserId(userId: string): Snippet[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM snippets WHERE user_id = ? ORDER BY category ASC, title ASC');
  return stmt.all(userId) as Snippet[];
}

export function getSnippetById(userId: string, snippetId: string): Snippet | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM snippets WHERE id = ? AND user_id = ?');
  const snippet = stmt.get(snippetId, userId) as Snippet | undefined;
  return snippet || null;
}

export function updateSnippet(userId: string, snippetId: string, updates: SnippetUpdateDTO): Snippet | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.command !== undefined) {
    fields.push('command = ?');
    values.push(updates.command);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  if (fields.length === 0) {
    return getSnippetById(userId, snippetId);
  }

  values.push(snippetId);
  values.push(userId);

  const stmt = db.prepare(`UPDATE snippets SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getSnippetById(userId, snippetId);
}

export function deleteSnippet(userId: string, snippetId: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM snippets WHERE id = ? AND user_id = ?');
  const result = stmt.run(snippetId, userId);
  return result.changes > 0;
}
