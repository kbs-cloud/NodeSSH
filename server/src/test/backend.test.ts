import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'path';

import { encryptPrivateKey, decryptPrivateKey } from '../security/vault';
import { generateEd25519Key, generateRSAKey, calculateFingerprint } from '../security/keygen';
import { parseMobaXtermIni, exportToMobaXtermIni } from '../utils/ini-parser';
import { getDb, closeDb } from '../db';
import { createUser, findUserById } from '../db/users';
import { createProfile, getProfilesByUserId, getProfileById, updateProfile, deleteProfile } from '../db/profiles';
import { createSSHKey, getKeysByUserId, getKeyById, deleteSSHKey } from '../db/keys';
import { createTunnel, getTunnelsByUserId, updateTunnel, deleteTunnel } from '../db/tunnels';
import { createSnippet, getSnippetsByUserId, updateSnippet, deleteSnippet } from '../db/snippets';
import { upsertSettings, getSettingsByUserId } from '../db/settings';
import { registerLocalUser, loginLocalUser } from '../auth/local';
import { verifyToken } from '../auth/middleware';
import { tunnelManager } from '../tunnels/tunnel-manager';
import { app, server } from '../index';

describe('NodeSSH Backend Test Suite', () => {
  let testUserId: string = '';
  let testServerPort = 3001;

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        testServerPort = addr.port;
        resolve();
      });
    });
  });

  describe('1. Key Vault & Security', () => {
    it('should encrypt and decrypt private keys using AES-256-GCM', () => {
      const sampleKey = '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-private-key-data\n-----END OPENSSH PRIVATE KEY-----';
      const encrypted = encryptPrivateKey(sampleKey);
      assert.notStrictEqual(encrypted, sampleKey);
      assert.strictEqual(typeof encrypted, 'string');

      const decrypted = decryptPrivateKey(encrypted);
      assert.strictEqual(decrypted, sampleKey);
    });

    it('should generate valid Ed25519 keypair and calculate fingerprint', () => {
      const keypair = generateEd25519Key('test-ed25519');
      assert.ok(keypair.publicKey.startsWith('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5'));
      assert.ok(keypair.publicKey.includes('test-ed25519'));
      assert.ok(keypair.privateKey.includes('PRIVATE KEY'));
      assert.ok(keypair.fingerprint.startsWith('SHA256:'));
      assert.strictEqual(keypair.keyType, 'ed25519');

      const calculatedFp = calculateFingerprint(keypair.publicKey);
      assert.strictEqual(calculatedFp, keypair.fingerprint);
    });

    it('should generate valid RSA 4096 keypair and calculate fingerprint', () => {
      const keypair = generateRSAKey(2048, 'test-rsa');
      assert.ok(keypair.publicKey.startsWith('ssh-rsa AAAAB3NzaC1yc2E'));
      assert.ok(keypair.publicKey.includes('test-rsa'));
      assert.ok(keypair.privateKey.includes('PRIVATE KEY'));
      assert.ok(keypair.fingerprint.startsWith('SHA256:'));
      assert.strictEqual(keypair.keyType, 'rsa');

      const calculatedFp = calculateFingerprint(keypair.publicKey);
      assert.strictEqual(calculatedFp, keypair.fingerprint);
    });
  });

  describe('2. Database Layer & Scoped Repositories', () => {
    it('should initialize database schema cleanly', () => {
      const db = getDb();
      assert.ok(db);
    });

    it('should create and retrieve users', async () => {
      const user = createUser({
        username: `testuser_${Date.now()}`,
        email: 'test@example.com',
      });
      assert.ok(user.id);
      testUserId = user.id;

      const fetched = findUserById(user.id);
      assert.strictEqual(fetched?.id, user.id);
      assert.strictEqual(fetched?.email, 'test@example.com');
    });

    it('should perform CRUD on profiles with user scoping', () => {
      const profile = createProfile(testUserId, {
        name: 'Production Web 01',
        host: '192.168.1.100',
        port: 22,
        username: 'ubuntu',
        auth_type: 'password',
        group_name: 'Production',
        tags: ['prod', 'web'],
      });
      assert.ok(profile.id);
      assert.strictEqual(profile.user_id, testUserId);
      assert.strictEqual(profile.name, 'Production Web 01');

      const list = getProfilesByUserId(testUserId);
      assert.ok(list.length >= 1);

      const updated = updateProfile(testUserId, profile.id, { name: 'Production Web 01 (Updated)' });
      assert.strictEqual(updated?.name, 'Production Web 01 (Updated)');

      const deleted = deleteProfile(testUserId, profile.id);
      assert.strictEqual(deleted, true);
      assert.strictEqual(getProfileById(testUserId, profile.id), null);
    });

    it('should perform CRUD on SSH keys', () => {
      const keypair = generateEd25519Key('vault-test-key');
      const encrypted = encryptPrivateKey(keypair.privateKey);

      const sshKey = createSSHKey(testUserId, {
        name: 'My Deploy Key',
        public_key: keypair.publicKey,
        encrypted_private_key: encrypted,
        key_type: 'ed25519',
        fingerprint: keypair.fingerprint,
      });

      assert.ok(sshKey.id);
      assert.strictEqual(sshKey.name, 'My Deploy Key');

      const keys = getKeysByUserId(testUserId);
      assert.ok(keys.length >= 1);

      const fetched = getKeyById(testUserId, sshKey.id);
      assert.strictEqual(fetched?.id, sshKey.id);

      const deleted = deleteSSHKey(testUserId, sshKey.id);
      assert.strictEqual(deleted, true);
    });

    it('should perform CRUD on snippets', () => {
      const snippet = createSnippet(testUserId, {
        title: 'Docker Cleanup',
        command: 'docker system prune -af',
        category: 'DevOps',
      });
      assert.ok(snippet.id);
      assert.strictEqual(snippet.title, 'Docker Cleanup');

      const updated = updateSnippet(testUserId, snippet.id, { title: 'Docker System Prune' });
      assert.strictEqual(updated?.title, 'Docker System Prune');

      const list = getSnippetsByUserId(testUserId);
      assert.ok(list.length >= 1);

      deleteSnippet(testUserId, snippet.id);
    });

    it('should save and load user settings', () => {
      const prefs = { theme: 'cyberpunk', fontSize: 14, cursorBlink: true };
      upsertSettings(testUserId, prefs);

      const loaded = getSettingsByUserId(testUserId);
      assert.strictEqual(loaded.theme, 'cyberpunk');
      assert.strictEqual(loaded.fontSize, 14);
      assert.strictEqual(loaded.cursorBlink, true);
    });
  });

  describe('3. Local Authentication & JWT', () => {
    const testUsername = `auth_test_${Date.now()}`;
    const testPassword = 'Password123!';

    it('should register a new local user and return token', async () => {
      const result = await registerLocalUser(testUsername, testPassword, 'auth@test.com');
      assert.ok(result.token);
      assert.strictEqual(result.user.username, testUsername);

      const decoded = verifyToken(result.token);
      assert.strictEqual(decoded.userId, result.user.id);
      assert.strictEqual(decoded.username, testUsername);
    });

    it('should authenticate user with valid password', async () => {
      const result = await loginLocalUser(testUsername, testPassword);
      assert.ok(result.token);
      assert.strictEqual(result.user.username, testUsername);
    });

    it('should reject invalid password', async () => {
      await assert.rejects(async () => {
        await loginLocalUser(testUsername, 'WrongPassword');
      });
    });
  });

  describe('4. MobaXterm .ini Importer & Exporter', () => {
    it('should parse MobaXterm .ini session formats', () => {
      const iniContent = `
[Bookmarks]
SubRep=
ImgNum=41

[Bookmarks_1]
SubRep=AWS Cloud
ImgNum=41
AWS-Bastion=#109#0%ec2-user@10.0.0.1%22%ec2-user%%-1%-1%%%22%%0%0%0%%-1%-1
AWS-Database=#109#0%db.internal.net%22%dbadmin%%-1%-1%%%22%%0%0%0%%-1%-1
      `.trim();

      const profiles = parseMobaXtermIni(iniContent);
      assert.strictEqual(profiles.length, 2);
      assert.strictEqual(profiles[0].name, 'AWS-Bastion');
      assert.strictEqual(profiles[0].host, 'ec2-user@10.0.0.1');
      assert.strictEqual(profiles[0].group_name, 'AWS Cloud');

      assert.strictEqual(profiles[1].name, 'AWS-Database');
      assert.strictEqual(profiles[1].host, 'db.internal.net');
      assert.strictEqual(profiles[1].username, 'dbadmin');
    });

    it('should export profiles into MobaXterm .ini format', () => {
      const sampleProfiles = [
        {
          id: 'p1',
          user_id: 'u1',
          name: 'Staging Server',
          host: '10.0.1.5',
          port: 2222,
          username: 'deploy',
          auth_type: 'password' as const,
          group_name: 'Staging',
          keepalive_interval: 15,
          close_on_exit: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ];

      const iniExport = exportToMobaXtermIni(sampleProfiles);
      assert.ok(iniExport.includes('[Bookmarks_1]'));
      assert.ok(iniExport.includes('SubRep=Staging'));
      assert.ok(iniExport.includes('Staging Server=#109#0%10.0.1.5%2222%deploy'));
    });
  });

  describe('5. REST API Integration Tests', () => {
    let authToken = '';
    const apiUsername = `api_user_${Date.now()}`;
    const apiPassword = 'ApiPassword123!';

    async function apiRequest(endpoint: string, options: { method?: string; body?: any; token?: string } = {}) {
      const { method = 'GET', body, token } = options;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`http://127.0.0.1:${testServerPort}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      return { status: res.status, headers: res.headers, data };
    }

    it('GET /api/health returns status ok', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'ok');
    });

    it('POST /api/auth/register creates user and returns JWT token', async () => {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: { username: apiUsername, password: apiPassword, email: 'api@nodessh.dev' },
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.token);
      assert.strictEqual(res.data.user.username, apiUsername);
      authToken = res.data.token;
    });

    it('GET /api/auth/me returns authenticated user details and preferences', async () => {
      const res = await apiRequest('/api/auth/me', { token: authToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.username, apiUsername);
      assert.ok(res.data.preferences !== undefined);
    });

    it('POST /api/profiles creates profile', async () => {
      const res = await apiRequest('/api/profiles', {
        method: 'POST',
        token: authToken,
        body: {
          name: 'Main Server',
          host: '10.0.0.10',
          port: 22,
          username: 'admin',
          auth_type: 'password',
        },
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.name, 'Main Server');
      assert.strictEqual(res.data.host, '10.0.0.10');
    });

    it('GET /api/profiles lists user profiles', async () => {
      const res = await apiRequest('/api/profiles', { token: authToken });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.some((p: any) => p.name === 'Main Server'));
    });

    it('GET /api/profiles/export?format=ini exports MobaXterm .ini format', async () => {
      const res = await apiRequest('/api/profiles/export?format=ini', { token: authToken });
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.data === 'string');
      assert.ok(res.data.includes('[Bookmarks]'));
    });

    it('POST /api/keys/generate creates new Ed25519 key in Key Vault', async () => {
      const res = await apiRequest('/api/keys/generate', {
        method: 'POST',
        token: authToken,
        body: {
          name: 'Auto Generated Ed25519',
          key_type: 'ed25519',
        },
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.data.publicKey.startsWith('ssh-ed25519'));
      assert.ok(res.data.key.fingerprint.startsWith('SHA256:'));
    });

    it('GET /api/tunnels/network-interfaces returns LAN IP interfaces', async () => {
      const res = await apiRequest('/api/tunnels/network-interfaces', { token: authToken });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.some((i: any) => i.address === '0.0.0.0'));
    });

    it('GET /api/system/info returns system telemetry and memory info', async () => {
      const res = await apiRequest('/api/system/info', { token: authToken });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.nodeVersion);
      assert.ok(res.data.memory.total > 0);
    });

    it('GET /api/auth/sso/config returns KBS SSO credentials configuration', async () => {
      const res = await apiRequest('/api/auth/sso/config');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.clientId, 'nodessh');
    });
  });

  after(() => {
    try {
      const db = getDb();
      if (testUserId) {
        db.prepare('DELETE FROM tunnels WHERE user_id = ?').run(testUserId);
        db.prepare('DELETE FROM profiles WHERE user_id = ?').run(testUserId);
        db.prepare('DELETE FROM ssh_keys WHERE user_id = ?').run(testUserId);
        db.prepare('DELETE FROM snippets WHERE user_id = ?').run(testUserId);
        db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
      }
    } catch {}
    closeDb();
    server.close();
  });
});
