import { getDb } from './index';
import { Tunnel, TunnelCreateDTO, TunnelUpdateDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function createTunnel(userId: string, data: TunnelCreateDTO): Tunnel {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const autoStart = data.auto_start ? 1 : 0;
  const bindHost = data.bind_host || '127.0.0.1';

  const stmt = db.prepare(`
    INSERT INTO tunnels (
      id, user_id, profile_id, name, tunnel_type,
      bind_host, bind_port, dest_host, dest_port,
      auto_start, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    id,
    userId,
    data.profile_id,
    data.name,
    data.tunnel_type,
    bindHost,
    data.bind_port,
    data.dest_host || null,
    data.dest_port || null,
    autoStart,
    now
  );

  return getTunnelById(userId, id)!;
}

export function getTunnelsByUserId(userId: string): Tunnel[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tunnels WHERE user_id = ? ORDER BY created_at DESC');
  return stmt.all(userId) as Tunnel[];
}

export function getTunnelById(userId: string, tunnelId: string): Tunnel | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tunnels WHERE id = ? AND user_id = ?');
  const tunnel = stmt.get(tunnelId, userId) as Tunnel | undefined;
  return tunnel || null;
}

export function getTunnelByIdGlobal(tunnelId: string): Tunnel | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tunnels WHERE id = ?');
  const tunnel = stmt.get(tunnelId) as Tunnel | undefined;
  return tunnel || null;
}

export function getAutoStartTunnels(): Tunnel[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tunnels WHERE auto_start = 1');
  return stmt.all() as Tunnel[];
}

export function updateTunnel(userId: string, tunnelId: string, updates: TunnelUpdateDTO): Tunnel | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.profile_id !== undefined) {
    fields.push('profile_id = ?');
    values.push(updates.profile_id);
  }
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.tunnel_type !== undefined) {
    fields.push('tunnel_type = ?');
    values.push(updates.tunnel_type);
  }
  if (updates.bind_host !== undefined) {
    fields.push('bind_host = ?');
    values.push(updates.bind_host);
  }
  if (updates.bind_port !== undefined) {
    fields.push('bind_port = ?');
    values.push(updates.bind_port);
  }
  if (updates.dest_host !== undefined) {
    fields.push('dest_host = ?');
    values.push(updates.dest_host);
  }
  if (updates.dest_port !== undefined) {
    fields.push('dest_port = ?');
    values.push(updates.dest_port);
  }
  if (updates.auto_start !== undefined) {
    fields.push('auto_start = ?');
    values.push(updates.auto_start ? 1 : 0);
  }

  if (fields.length === 0) {
    return getTunnelById(userId, tunnelId);
  }

  values.push(tunnelId);
  values.push(userId);

  const stmt = db.prepare(`UPDATE tunnels SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getTunnelById(userId, tunnelId);
}

export function deleteTunnel(userId: string, tunnelId: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM tunnels WHERE id = ? AND user_id = ?');
  const result = stmt.run(tunnelId, userId);
  return result.changes > 0;
}
