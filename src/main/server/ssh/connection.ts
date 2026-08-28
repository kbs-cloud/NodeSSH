import fs from 'fs';
import path from 'path';
import { Client, ConnectConfig } from 'ssh2';
import { Profile, SSHKey } from '../types';
import { getProfileById } from '../db/profiles';
import { getKeyById } from '../db/keys';
import { decryptPrivateKey } from '../security/vault';

export interface SSHConnectionOptions {
  userId: string;
  profileId?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  keyId?: string;
  privateKey?: string;
  passphrase?: string;
  jumpHostId?: string;
  keepaliveInterval?: number;
  sftpCommand?: string;
}

export interface SSHConnectionResult {
  client: Client;
  jumpClient?: Client;
}

/**
 * Creates and connects an SSH2 Client instance with support for passwords,
 * decrypted key vault keys, and chained Jump Host (ProxyJump) bastions.
 */
export async function createSSHConnection(options: SSHConnectionOptions): Promise<SSHConnectionResult> {
  const { userId } = options;

  let host = options.host;
  let port = options.port || 22;
  let username = options.username;
  let password = options.password;
  let privateKey = options.privateKey;
  let passphrase = options.passphrase;
  let jumpHostId = options.jumpHostId;
  let keepalive = options.keepaliveInterval ?? 15;

  // If a profileId is specified, merge settings from database
  if (options.profileId) {
    const profile = getProfileById(userId, options.profileId);
    if (profile) {
      host = host || profile.host;
      port = options.port || profile.port;
      username = username || profile.username;
      password = password || profile.password || undefined;
      passphrase = passphrase || profile.passphrase || undefined;
      jumpHostId = jumpHostId || profile.jump_host_id || undefined;
      keepalive = profile.keepalive_interval ?? keepalive;

      if (!privateKey && profile.key_id) {
        const keyRecord = getKeyById(userId, profile.key_id);
        if (keyRecord) {
          privateKey = decryptPrivateKey(keyRecord.encrypted_private_key);
        }
      }
    } else if (!host) {
      throw new Error(`Profile with ID '${options.profileId}' not found and no host provided`);
    }
  }

  // Resolve direct keyId if privateKey not yet loaded
  if (!privateKey && options.keyId) {
    const keyRecord = getKeyById(userId, options.keyId);
    if (keyRecord) {
      privateKey = decryptPrivateKey(keyRecord.encrypted_private_key);
    }
  }

  if (!privateKey && !password) {
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    const defaultEd = path.join(homeDir, '.ssh', 'id_ed25519');
    const defaultRsa = path.join(homeDir, '.ssh', 'id_rsa');
    if (fs.existsSync(defaultEd)) {
      try { privateKey = fs.readFileSync(defaultEd, 'utf8'); } catch {}
    } else if (fs.existsSync(defaultRsa)) {
      try { privateKey = fs.readFileSync(defaultRsa, 'utf8'); } catch {}
    }
  }

  if (privateKey && typeof privateKey === 'string' && !privateKey.includes('PRIVATE KEY') && fs.existsSync(privateKey)) {
    try { privateKey = fs.readFileSync(privateKey, 'utf8'); } catch {}
  }

  if (!host || !username) {
    throw new Error('Host and Username are required for SSH connection');
  }

  let jumpClient: Client | undefined;
  let socketStream: any;

  // Handle Jump Host / Bastion Proxy if configured
  if (jumpHostId) {
    const jumpProfile = getProfileById(userId, jumpHostId);
    if (!jumpProfile) {
      throw new Error(`Jump Host profile with ID '${jumpHostId}' not found`);
    }

    let jumpPrivKey: string | undefined;
    if (jumpProfile.key_id) {
      const jumpKeyRecord = getKeyById(userId, jumpProfile.key_id);
      if (jumpKeyRecord) {
        jumpPrivKey = decryptPrivateKey(jumpKeyRecord.encrypted_private_key);
      }
    }

    jumpClient = await new Promise<Client>((resolve, reject) => {
      const jc = new Client();
      jc.on('ready', () => resolve(jc));
      jc.on('error', (err) => reject(new Error(`Jump Host connection failed: ${err.message}`)));

      jc.connect({
        host: jumpProfile.host,
        port: jumpProfile.port || 22,
        username: jumpProfile.username,
        password: jumpProfile.password || undefined,
        privateKey: jumpPrivKey,
        passphrase: jumpProfile.passphrase || undefined,
        keepaliveInterval: (jumpProfile.keepalive_interval ?? 15) * 1000,
        keepaliveCountMax: 3,
        readyTimeout: 30000,
        algorithms: {
          serverHostKey: [
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'rsa-sha2-512',
            'rsa-sha2-256',
            'ssh-rsa',
          ],
        },
      });
    });

    // Forward through jump host to target host:port
    socketStream = await new Promise<any>((resolve, reject) => {
      jumpClient!.forwardOut('127.0.0.1', 0, host!, port, (err, stream) => {
        if (err) {
          return reject(new Error(`Jump Host forwarding failed to ${host}:${port}: ${err.message}`));
        }
        resolve(stream);
      });
    });
  }

  // Connect to target host
  const client = await new Promise<Client>((resolve, reject) => {
    const targetClient = new Client();

    targetClient.on('ready', () => {
      resolve(targetClient);
    });

    targetClient.on('error', (err) => {
      if (jumpClient) {
        jumpClient.end();
      }
      reject(new Error(`SSH connection to ${username}@${host}:${port} failed: ${err.message}`));
    });

    const connectConfig: ConnectConfig = {
      host,
      port,
      username,
      password,
      privateKey,
      passphrase,
      sock: socketStream,
      keepaliveInterval: keepalive * 1000,
      keepaliveCountMax: 3,
      readyTimeout: 30000,
      algorithms: {
        serverHostKey: [
          'ssh-ed25519',
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521',
          'rsa-sha2-512',
          'rsa-sha2-256',
          'ssh-rsa',
        ],
      },
    };

    try {
      targetClient.connect(connectConfig);
    } catch (err: any) {
      if (jumpClient) {
        jumpClient.end();
      }
      reject(new Error(`Failed to initiate SSH connection: ${err.message}`));
    }
  });

  return { client, jumpClient };
}
