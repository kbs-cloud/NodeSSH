import { Client } from 'ssh2';

export interface SSHCopyIdOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  publicKey: string;
  timeout?: number;
}

export interface SSHCopyIdResult {
  success: boolean;
  message: string;
  status: 'installed' | 'already_exists' | 'error';
  details?: string;
}

/**
 * Connects to remote SSH host and installs public key into ~/.ssh/authorized_keys
 */
export async function pushPublicKeyToHost(options: SSHCopyIdOptions): Promise<SSHCopyIdResult> {
  const {
    host,
    port = 22,
    username,
    password,
    privateKey,
    passphrase,
    publicKey,
    timeout = 15000,
  } = options;

  if (!publicKey || !publicKey.trim()) {
    throw new Error('Public key cannot be empty');
  }

  const cleanPublicKey = publicKey.trim();

  return new Promise((resolve) => {
    const conn = new Client();
    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        conn.end();
        resolve({
          success: false,
          status: 'error',
          message: 'Connection timed out while attempting ssh-copy-id',
        });
      }
    }, timeout);

    conn.on('ready', () => {
      // Safely escape single quotes for shell script
      const escapedKey = cleanPublicKey.replace(/'/g, "'\\''");
      const remoteCmd = `
        set -e
        umask 077
        mkdir -p ~/.ssh
        chmod 700 ~/.ssh
        touch ~/.ssh/authorized_keys
        chmod 600 ~/.ssh/authorized_keys
        if grep -q -F '${escapedKey}' ~/.ssh/authorized_keys; then
          echo "__NODESSH_KEY_EXISTS__"
        else
          echo '${escapedKey}' >> ~/.ssh/authorized_keys
          echo "__NODESSH_KEY_ADDED__"
        fi
      `.trim();

      conn.exec(remoteCmd, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          if (!isResolved) {
            isResolved = true;
            conn.end();
            resolve({
              success: false,
              status: 'error',
              message: `Failed to execute remote command: ${err.message}`,
            });
          }
          return;
        }

        let stdoutData = '';
        let stderrData = '';

        stream.on('data', (data: Buffer) => {
          stdoutData += data.toString('utf8');
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderrData += data.toString('utf8');
        });

        stream.on('close', (code: number) => {
          clearTimeout(timer);
          if (!isResolved) {
            isResolved = true;
            conn.end();

            if (code === 0 || stdoutData.includes('__NODESSH_KEY_ADDED__') || stdoutData.includes('__NODESSH_KEY_EXISTS__')) {
              if (stdoutData.includes('__NODESSH_KEY_EXISTS__')) {
                resolve({
                  success: true,
                  status: 'already_exists',
                  message: 'Public key is already present in ~/.ssh/authorized_keys',
                });
              } else {
                resolve({
                  success: true,
                  status: 'installed',
                  message: 'Public key successfully installed to ~/.ssh/authorized_keys with secure permissions',
                });
              }
            } else {
              resolve({
                success: false,
                status: 'error',
                message: `Failed to install key (exit code ${code}): ${stderrData || stdoutData}`,
                details: stderrData,
              });
            }
          }
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timer);
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          status: 'error',
          message: `SSH Connection error: ${err.message}`,
        });
      }
    });

    try {
      conn.connect({
        host,
        port,
        username,
        password,
        privateKey,
        passphrase,
        readyTimeout: timeout,
      });
    } catch (connectErr: any) {
      clearTimeout(timer);
      if (!isResolved) {
        isResolved = true;
        resolve({
          success: false,
          status: 'error',
          message: `Connection initialization error: ${connectErr.message}`,
        });
      }
    }
  });
}
