import fs from 'fs';
import path from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config';

let dbInstance: DatabaseType | null = null;

export function getDb(): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  dbInstance = db;
  return dbInstance;
}

function initSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      email TEXT,
      sso_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ssh_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      public_key TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      key_type TEXT NOT NULL DEFAULT 'ed25519',
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      auth_type TEXT NOT NULL DEFAULT 'password',
      password TEXT,
      key_id TEXT,
      passphrase TEXT,
      jump_host_id TEXT,
      initial_dir TEXT,
      startup_command TEXT,
      keepalive_interval INTEGER NOT NULL DEFAULT 15,
      close_on_exit INTEGER NOT NULL DEFAULT 1,
      tags TEXT,
      group_name TEXT,
      terminal_theme TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (key_id) REFERENCES ssh_keys(id) ON DELETE SET NULL,
      FOREIGN KEY (jump_host_id) REFERENCES profiles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tunnels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      tunnel_type TEXT NOT NULL DEFAULT 'local',
      bind_host TEXT NOT NULL DEFAULT '127.0.0.1',
      bind_port INTEGER NOT NULL,
      dest_host TEXT,
      dest_port INTEGER,
      auto_start INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      command TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      preferences_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for high performance query isolation by user_id
    CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_keys_user ON ssh_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_tunnels_user ON tunnels(user_id);
    CREATE INDEX IF NOT EXISTS idx_snippets_user ON snippets(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_sso ON users(sso_id);
  `);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
