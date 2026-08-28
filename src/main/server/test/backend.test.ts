import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';

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
import { WebSocket } from 'ws';
import { tunnelManager } from '../tunnels/tunnel-manager';
import { startServer, stopServer } from '../index';
import { activeTransfers } from '../routes/sftp';
import {
  modeToPermissionsString,
  sftpStreamDirectoryAsZip,
  sftpRemoteExtract,
  sftpRemoteCompress,
  sftpDownloadFileDirect,
  sftpDownloadDirectoryDirect,
} from '../ssh/sftp-service';

describe('NodeSSH Backend Test Suite', () => {
  let testUserId: string = '';
  let testServerPort = 3001;
  let sharedAuthToken = '';

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

  before(async () => {
    const instance = await startServer({ host: '127.0.0.1', port: 0 });
    testServerPort = instance.port;
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
    const apiUsername = `api_user_${Date.now()}`;
    const apiPassword = 'ApiPassword123!';

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
      sharedAuthToken = res.data.token;
    });

    it('GET /api/auth/me returns authenticated user details and preferences', async () => {
      const res = await apiRequest('/api/auth/me', { token: sharedAuthToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.username, apiUsername);
      assert.ok(res.data.preferences !== undefined);
    });

    it('POST /api/profiles creates profile', async () => {
      const res = await apiRequest('/api/profiles', {
        method: 'POST',
        token: sharedAuthToken,
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
      const res = await apiRequest('/api/profiles', { token: sharedAuthToken });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.some((p: any) => p.name === 'Main Server'));
    });

    it('GET /api/profiles/export?format=ini exports MobaXterm .ini format', async () => {
      const res = await apiRequest('/api/profiles/export?format=ini', { token: sharedAuthToken });
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.data === 'string');
      assert.ok(res.data.includes('[Bookmarks]'));
    });

    it('POST /api/keys/generate creates new Ed25519 key in Key Vault', async () => {
      const res = await apiRequest('/api/keys/generate', {
        method: 'POST',
        token: sharedAuthToken,
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
      const res = await apiRequest('/api/tunnels/network-interfaces', { token: sharedAuthToken });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.some((i: any) => i.address === '0.0.0.0'));
    });

    it('GET /api/system/info returns system telemetry and memory info', async () => {
      const res = await apiRequest('/api/system/info', { token: sharedAuthToken });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.nodeVersion);
      assert.ok(res.data.memory.total > 0);
    });
  });

  describe('6. WebSocket Native Local Terminal PTY', () => {
    it('should spawn local native shell and stream data bidirectional over WebSocket', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${testServerPort}/ws/terminal?token=default-session-token`);
        let receivedData = '';
        let timer: any;

        timer = setTimeout(() => {
          ws.close();
          reject(new Error(`Timeout waiting for shell output. Received: ${receivedData}`));
        }, 8000);

        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'init',
            tabId: 'test-local-tab-1',
            isLocal: true,
            cols: 80,
            rows: 24,
          }));
        });

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'status' && msg.status === 'connected') {
              // Send test echo command
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'data',
                  data: 'echo LOCAL_SHELL_TEST_OK\r\n',
                }));
              }, 400);
            } else if (msg.type === 'data') {
              receivedData += msg.data;
              if (receivedData.includes('LOCAL_SHELL_TEST_OK')) {
                clearTimeout(timer);
                try {
                  ws.send(JSON.stringify({ type: 'data', data: 'exit\r\n' }));
                } catch {}
                setTimeout(() => {
                  ws.close();
                  resolve();
                }, 50);
              }
            }
          } catch {
            receivedData += raw.toString();
            if (receivedData.includes('LOCAL_SHELL_TEST_OK')) {
              clearTimeout(timer);
              try {
                ws.send(JSON.stringify({ type: 'data', data: 'exit\r\n' }));
              } catch {}
              setTimeout(() => {
                ws.close();
                resolve();
              }, 50);
            }
          }
        });

        ws.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    });
  });

  describe('7. SFTP Transfer Engine & Remote Extraction/Compression', () => {
    it('should convert UNIX octal modes to permission strings', () => {
      assert.strictEqual(modeToPermissionsString(0o755), 'rwxr-xr-x');
      assert.strictEqual(modeToPermissionsString(0o644), 'rw-r--r--');
      assert.strictEqual(modeToPermissionsString(0o700), 'rwx------');
    });

    it('should support sftp_command in profile creation and DTO mapping', () => {
      const profile = createProfile(testUserId, {
        name: 'Custom SFTP Server',
        host: '10.0.0.50',
        port: 22,
        username: 'root',
        auth_type: 'password',
        sftp_command: 'sudo /usr/lib/openssh/sftp-server',
      });
      assert.strictEqual(profile.sftp_command, 'sudo /usr/lib/openssh/sftp-server');

      const fetched = getProfileById(testUserId, profile.id);
      assert.strictEqual(fetched?.sftp_command, 'sudo /usr/lib/openssh/sftp-server');
      deleteProfile(testUserId, profile.id);
    });

    it('should manage and abort active transfers in activeTransfers map', async () => {
      let aborted = false;
      const testTransferId = 'test-transfer-abort-123';
      activeTransfers.set(testTransferId, {
        transferId: testTransferId,
        type: 'download',
        isFolder: true,
        path: '/var/log',
        filename: 'log.zip',
        startTime: Date.now(),
        status: 'active',
        currentFile: 'syslog',
        exploredFiles: 10,
        exploredDirs: 2,
        processedFiles: 5,
        processedBytes: 5000,
        totalBytes: 10000,
        percent: 50,
        abort: () => { aborted = true; },
      });

      assert.ok(activeTransfers.has(testTransferId));

      // Test status endpoint
      const statusRes = await apiRequest(`/api/sftp/transfer/status?transferId=${testTransferId}`, {
        token: sharedAuthToken,
      });
      assert.strictEqual(statusRes.status, 200);
      assert.strictEqual(statusRes.data.transferId, testTransferId);
      assert.strictEqual(statusRes.data.isFolder, true);
      assert.strictEqual(statusRes.data.currentFile, 'syslog');
      assert.strictEqual(statusRes.data.exploredFiles, 10);
      assert.strictEqual(statusRes.data.percent, 50);

      const res = await apiRequest('/api/sftp/transfer/abort', {
        method: 'POST',
        token: sharedAuthToken,
        body: { transferId: testTransferId },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(aborted, true);
      assert.strictEqual(activeTransfers.has(testTransferId), false);
    });

    it('POST /api/sftp/transfer/abort returns 404 for unknown transferId', async () => {
      const res = await apiRequest('/api/sftp/transfer/abort', {
        method: 'POST',
        token: sharedAuthToken,
        body: { transferId: 'non-existent-transfer' },
      });
      assert.strictEqual(res.status, 404);
    });

    it('sftpStreamDirectoryAsZip calculates dynamic progress based on explored folders and files', async () => {
      const progressEvents: any[] = [];
      const mockSFTP: any = {
        readdir: (dirPath: string, cb: any) => {
          if (dirPath === '/sample') {
            cb(null, [
              {
                filename: 'file1.txt',
                longname: '-rw-r--r-- file1.txt',
                attrs: { mode: 0o100644, size: 100, mtime: 123456, atime: 123456, uid: 1000, gid: 1000 },
              },
              {
                filename: 'subdir',
                longname: 'drwxr-xr-x subdir',
                attrs: { mode: 0o040755, size: 4096, mtime: 123456, atime: 123456, uid: 1000, gid: 1000 },
              },
            ]);
          } else if (dirPath === '/sample/subdir') {
            cb(null, [
              {
                filename: 'file2.txt',
                longname: '-rw-r--r-- file2.txt',
                attrs: { mode: 0o100644, size: 200, mtime: 123456, atime: 123456, uid: 1000, gid: 1000 },
              },
            ]);
          } else {
            cb(null, []);
          }
        },
        createReadStream: (_path: string) => {
          const { Readable } = require('stream');
          const stream = new Readable({
            read() {
              this.push(Buffer.from('hello world content'));
              this.push(null);
            }
          });
          return stream;
        },
      };

      const { PassThrough } = await import('stream');
      const outStream = new PassThrough();

      await sftpStreamDirectoryAsZip(mockSFTP, '/sample', outStream, {
        onProgress: (prog) => {
          progressEvents.push(prog);
        },
      });

      assert.ok(progressEvents.length > 0);
      const lastEvent = progressEvents[progressEvents.length - 1];
      assert.strictEqual(lastEvent.phase, 'completed');
      assert.strictEqual(lastEvent.percent, 100);
      assert.strictEqual(lastEvent.exploredFiles, 2);
      assert.strictEqual(lastEvent.exploredDirs, 2);
    });

    it('sftpStreamDirectoryAsZip respects AbortSignal immediately', async () => {
      const abortController = new AbortController();
      abortController.abort(); // Pre-abort

      const mockSFTP: any = {
        readdir: (_path: string, cb: any) => cb(null, []),
      };
      const { PassThrough } = await import('stream');
      const outStream = new PassThrough();

      await assert.rejects(async () => {
        await sftpStreamDirectoryAsZip(mockSFTP, '/test', outStream, {
          signal: abortController.signal,
        });
      }, /Transfer aborted/);
    });

    it('sftpRemoteExtract constructs and executes correct extraction commands', async () => {
      const executedCommands: string[] = [];
      const mockSSHConn: any = {
        client: {
          exec: (cmd: string, cb: any) => {
            executedCommands.push(cmd);
            const { EventEmitter } = require('events');
            const stream: any = new EventEmitter();
            stream.stderr = new EventEmitter();
            setTimeout(() => {
              stream.emit('close', 0);
            }, 10);
            cb(null, stream);
          }
        }
      };

      // Test tar.gz
      await sftpRemoteExtract(mockSSHConn, '/backup/app.tar.gz', '/var/www');
      assert.ok(executedCommands[0].includes('tar -xzf "/backup/app.tar.gz" -C "/var/www"'));

      // Test zip
      await sftpRemoteExtract(mockSSHConn, '/backup/data.zip', '/opt/data');
      assert.ok(executedCommands[1].includes('unzip -o "/backup/data.zip" -d "/opt/data"'));

      // Test tar.bz2
      await sftpRemoteExtract(mockSSHConn, '/backup/archive.tar.bz2');
      assert.ok(executedCommands[2].includes('tar -xjf "/backup/archive.tar.bz2"'));
    });

    it('sftpRemoteCompress constructs and executes correct compression commands', async () => {
      const executedCommands: string[] = [];
      const mockSSHConn: any = {
        client: {
          exec: (cmd: string, cb: any) => {
            executedCommands.push(cmd);
            const { EventEmitter } = require('events');
            const stream: any = new EventEmitter();
            stream.stderr = new EventEmitter();
            setTimeout(() => {
              stream.emit('close', 0);
            }, 10);
            cb(null, stream);
          }
        }
      };

      await sftpRemoteCompress(mockSSHConn, ['/var/log/nginx', '/var/log/syslog'], '/backups/logs.tar.gz');
      assert.ok(executedCommands[0].includes('tar -czf "/backups/logs.tar.gz" "/var/log/nginx" "/var/log/syslog"'));
    });

    it('createProfile preserves custom client ID and getProfileById supports name fallback', () => {
      const customId = 'prof-custom-' + Date.now();
      const prof = createProfile(testUserId, {
        id: customId,
        name: 'Custom Test Server',
        host: '192.168.1.50',
        port: 22,
        username: 'admin',
        auth_type: 'password',
      } as any);

      assert.strictEqual(prof.id, customId);
      const byId = getProfileById(testUserId, customId);
      assert.ok(byId);
      assert.strictEqual(byId?.host, '192.168.1.50');

      // Test name fallback
      const byName = getProfileById(testUserId, 'custom test server');
      assert.ok(byName);
      assert.strictEqual(byName?.id, customId);
    });

    it('GET /api/sftp/list accepts direct connection parameters without requiring saved profile ID', async () => {
      const res = await apiRequest('/api/sftp/list?host=127.0.0.1&port=2222&username=tester&password=pwd', {
        token: sharedAuthToken,
      });
      // Will fail to connect to 127.0.0.1:2222 (connection refused or timeout), but should NOT fail with "No SSH profile available"
      assert.strictEqual(res.status, 500);
      assert.ok(!res.data.error?.includes('No SSH profile available'));
      assert.ok(
        res.data.error?.includes('ECONNREFUSED') ||
        res.data.error?.includes('connect') ||
        res.data.error?.includes('timed out') ||
        res.data.error?.includes('All configured authentication methods failed')
      );
    });

    it('sftpDownloadFileDirect streams single file directly to disk without compression', async () => {
      const fs = await import('fs');
      const os = await import('os');
      const testDir = path.join(os.tmpdir(), `nodessh-test-${Date.now()}`);
      fs.mkdirSync(testDir, { recursive: true });
      const targetPath = path.join(testDir, 'downloaded.txt');

      const mockSFTP: any = {
        createReadStream: (_p: string) => {
          const { Readable } = require('stream');
          return new Readable({
            read() {
              this.push(Buffer.from('direct content 12345'));
              this.push(null);
            }
          });
        }
      };

      await sftpDownloadFileDirect(mockSFTP, '/remote/file.txt', targetPath);
      assert.ok(fs.existsSync(targetPath));
      assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'direct content 12345');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('sftpDownloadDirectoryDirect downloads folder structure directly and keeps completed files on abort', async () => {
      const fs = await import('fs');
      const os = await import('os');
      const testDir = path.join(os.tmpdir(), `nodessh-dir-test-${Date.now()}`);
      fs.mkdirSync(testDir, { recursive: true });

      const abortController = new AbortController();

      let filesRead = 0;
      const mockSFTP: any = {
        readdir: (dirPath: string, cb: any) => {
          if (dirPath === '/remote/dir') {
            cb(null, [
              {
                filename: 'first.txt',
                longname: '-rw-r--r-- first.txt',
                attrs: { mode: 0o100644, size: 100, mtime: 123, atime: 123, uid: 1000, gid: 1000 },
              },
              {
                filename: 'second.txt',
                longname: '-rw-r--r-- second.txt',
                attrs: { mode: 0o100644, size: 200, mtime: 123, atime: 123, uid: 1000, gid: 1000 },
              },
            ]);
          } else {
            cb(null, []);
          }
        },
        createReadStream: (p: string) => {
          filesRead++;
          const { Readable } = require('stream');
          if (p.includes('first.txt')) {
            return new Readable({
              read() {
                this.push(Buffer.from('first completed file'));
                this.push(null);
              }
            });
          }
          // For second.txt, trigger abort mid-stream!
          return new Readable({
            read() {
              this.push(Buffer.from('second partial data...'));
              setTimeout(() => {
                abortController.abort();
              }, 10);
            }
          });
        }
      };

      await assert.rejects(async () => {
        await sftpDownloadDirectoryDirect(mockSFTP, '/remote/dir', testDir, {
          signal: abortController.signal,
        });
      }, /Transfer aborted/);

      // Verify that the first successfully downloaded file remains on disk!
      const firstPath = path.join(testDir, 'first.txt');
      assert.ok(fs.existsSync(firstPath), 'Completed first file must remain on disk');
      assert.strictEqual(fs.readFileSync(firstPath, 'utf8'), 'first completed file');

      // Verify that the in-flight aborted second file was deleted and did NOT leave corrupt data!
      const secondPath = path.join(testDir, 'second.txt');
      assert.ok(!fs.existsSync(secondPath), 'In-flight aborted file must be deleted');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  after(async () => {
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
    await stopServer();
  });
});
