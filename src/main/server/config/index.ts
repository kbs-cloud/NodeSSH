import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

export interface ServerConfigOptions {
  port?: number;
  host?: string;
  userDataPath?: string;
  dataDir?: string;
  dbPath?: string;
  clientDistPath?: string;
  jwtSecret?: string;
  jwtExpiresIn?: string;
  vaultEncryptionKey?: string;
}

function resolveDefaultDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  if (process.env.DB_PATH) {
    return path.dirname(path.resolve(process.env.DB_PATH));
  }

  // Attempt to resolve Electron userData path if running in Electron environment
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    const electronApp = electron?.app || electron?.remote?.app;
    if (electronApp && typeof electronApp.getPath === 'function') {
      const userData = electronApp.getPath('userData');
      if (userData) {
        return path.join(userData, 'data');
      }
    }
  } catch {
    // Standalone / test fallback
  }

  return path.join(os.homedir(), '.nodessh', 'data');
}

function resolveDefaultClientDist(): string {
  if (process.env.CLIENT_DIST_PATH) {
    return path.resolve(process.env.CLIENT_DIST_PATH);
  }

  let appRoot = process.cwd();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    const electronApp = electron?.app || electron?.remote?.app;
    if (electronApp && typeof electronApp.getAppPath === 'function') {
      appRoot = electronApp.getAppPath();
    }
  } catch {}

  const candidates = [
    path.join(appRoot, 'dist/renderer'),
    path.resolve(__dirname, '../../renderer'),
    path.resolve(__dirname, '../../../renderer'),
    path.resolve(__dirname, '../../../../renderer'),
    path.resolve(process.cwd(), 'dist/renderer'),
    path.resolve(process.cwd(), 'src/renderer/dist'),
    path.resolve(process.cwd(), 'renderer/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(__dirname, '../../../renderer/dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

class ServerConfig {
  private _port: number = parseInt(
    process.env.PORT || (process.env.NODE_ENV === 'production' ? '3000' : '3001'),
    10
  );
  private _host: string = process.env.HOST || '127.0.0.1';
  private _dataDir: string = resolveDefaultDataDir();
  private _dbPath: string = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(this._dataDir, 'nodessh.db');
  private _clientDistPath: string = resolveDefaultClientDist();

  public jwtSecret: string = process.env.JWT_SECRET || 'nodessh-super-secret-jwt-key-2026';
  public jwtExpiresIn: string = process.env.JWT_EXPIRES_IN || '7d';
  public vaultEncryptionKey: string =
    process.env.VAULT_ENCRYPTION_KEY || 'nodessh-vault-master-key-32-byte';

  get port(): number {
    return this._port;
  }
  set port(val: number) {
    this._port = val;
  }

  get host(): string {
    return this._host;
  }
  set host(val: string) {
    this._host = val;
  }

  get dataDir(): string {
    return this._dataDir;
  }
  set dataDir(val: string) {
    this._dataDir = path.resolve(val);
    if (!process.env.DB_PATH) {
      this._dbPath = path.join(this._dataDir, 'nodessh.db');
    }
    this.ensureDataDir();
  }

  get dbPath(): string {
    return this._dbPath;
  }
  set dbPath(val: string) {
    this._dbPath = path.resolve(val);
    this._dataDir = path.dirname(this._dbPath);
    this.ensureDataDir();
  }

  get clientDistPath(): string {
    return this._clientDistPath;
  }
  set clientDistPath(val: string) {
    this._clientDistPath = path.resolve(val);
  }

  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public ensureDataDir(): void {
    try {
      if (!fs.existsSync(this._dataDir)) {
        fs.mkdirSync(this._dataDir, { recursive: true });
      }

      // Check if target database is missing or empty, and migrate from legacy candidates
      if (!fs.existsSync(this._dbPath) || fs.statSync(this._dbPath).size === 0) {
        const legacyCandidates = [
          path.join(process.env.APPDATA || '', 'Electron', 'data', 'nodessh.db'),
          path.join(process.env.APPDATA || '', 'nodessh', 'data', 'nodessh.db'),
          path.resolve(process.cwd(), 'data', 'nodessh.db'),
        ];
        for (const candidate of legacyCandidates) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0 && path.resolve(candidate) !== path.resolve(this._dbPath)) {
            try {
              console.log(`[NodeSSH] Migrating existing database from ${candidate} -> ${this._dbPath}`);
              fs.copyFileSync(candidate, this._dbPath);
              break;
            } catch (err: any) {
              console.error(`[NodeSSH] Could not migrate database from ${candidate}:`, err.message);
            }
          }
        }
      }
    } catch {}
  }

  public init(options: ServerConfigOptions = {}): void {
    if (options.port !== undefined) {
      this._port = options.port;
    }
    if (options.host !== undefined) {
      this._host = options.host;
    }
    if (options.userDataPath) {
      this.dataDir = path.join(options.userDataPath, 'data');
    } else if (options.dataDir) {
      this.dataDir = options.dataDir;
    }
    if (options.dbPath) {
      this.dbPath = options.dbPath;
    }
    if (options.clientDistPath) {
      this._clientDistPath = path.resolve(options.clientDistPath);
    }
    if (options.jwtSecret) {
      this.jwtSecret = options.jwtSecret;
    }
    if (options.jwtExpiresIn) {
      this.jwtExpiresIn = options.jwtExpiresIn;
    }
    if (options.vaultEncryptionKey) {
      this.vaultEncryptionKey = options.vaultEncryptionKey;
    }

    this.ensureDataDir();
  }
}

export const config = new ServerConfig();
