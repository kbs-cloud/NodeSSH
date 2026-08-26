import { SFTPWrapper, Client } from 'ssh2';
import { createSSHConnection, SSHConnectionOptions, SSHConnectionResult } from './connection';
import { SFTPFileEntry, SFTPStat } from '../types';
import { Readable, Writable } from 'stream';
import path from 'path';
const archiver = require('archiver');

export interface SFTPContext {
  sftp: SFTPWrapper;
  sshConn: SSHConnectionResult;
  close: () => void;
}

/**
 * Converts UNIX mode number to standard permission string (e.g., 'rwxr-xr-x')
 */
export function modeToPermissionsString(mode: number): string {
  const flags = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const user = flags[(mode >> 6) & 7];
  const group = flags[(mode >> 3) & 7];
  const others = flags[mode & 7];
  return `${user}${group}${others}`;
}

/**
 * Opens an SFTP session from SSH connection parameters or profile
 */
export async function openSFTPSession(options: SSHConnectionOptions): Promise<SFTPContext> {
  const sshConn = await createSSHConnection(options);

  const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
    sshConn.client.sftp((err, sftpWrapper) => {
      if (err) {
        sshConn.client.end();
        if (sshConn.jumpClient) sshConn.jumpClient.end();
        return reject(new Error(`Failed to open SFTP subsystem: ${err.message}`));
      }
      resolve(sftpWrapper);
    });
  });

  const close = () => {
    try {
      sftp.end();
    } catch {
      // Ignore
    }
    try {
      sshConn.client.end();
      sshConn.client.destroy();
    } catch {
      // Ignore
    }
    if (sshConn.jumpClient) {
      try {
        sshConn.jumpClient.end();
        sshConn.jumpClient.destroy();
      } catch {
        // Ignore
      }
    }
  };

  return { sftp, sshConn, close };
}

/**
 * Lists contents of a remote directory with complete attributes
 */
export async function sftpList(sftp: SFTPWrapper, remotePath: string): Promise<SFTPFileEntry[]> {
  const normalizedPath = remotePath.replace(/\\/g, '/') || '/';

  return new Promise((resolve, reject) => {
    sftp.readdir(normalizedPath, (err, list) => {
      if (err) {
        return reject(new Error(`SFTP readdir failed for '${normalizedPath}': ${err.message}`));
      }

      const entries: SFTPFileEntry[] = list.map((item) => {
        const mode = item.attrs.mode;
        // Check directory bit: S_IFDIR is 0o040000
        const isDir = (mode & 0o170000) === 0o040000;
        // Check symlink bit: S_IFLNK is 0o120000
        const isSymlink = (mode & 0o170000) === 0o120000;

        return {
          filename: item.filename,
          longname: item.longname,
          isDirectory: isDir,
          isSymbolicLink: isSymlink,
          size: item.attrs.size,
          modifyTime: item.attrs.mtime * 1000,
          accessTime: item.attrs.atime * 1000,
          permissions: modeToPermissionsString(mode),
          mode: mode & 0o777,
          uid: item.attrs.uid,
          gid: item.attrs.gid,
        };
      });

      // Sort directories first, then alphabetical
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.filename.localeCompare(b.filename);
      });

      resolve(entries);
    });
  });
}

/**
 * Retrieves stats for a remote file or directory
 */
export async function sftpStat(sftp: SFTPWrapper, remotePath: string): Promise<SFTPStat> {
  const normalizedPath = remotePath.replace(/\\/g, '/') || '/';

  return new Promise((resolve, reject) => {
    sftp.stat(normalizedPath, (err, stats) => {
      if (err) {
        return reject(new Error(`SFTP stat failed for '${normalizedPath}': ${err.message}`));
      }

      const mode = stats.mode;
      const isDir = (mode & 0o170000) === 0o040000;
      const isFile = (mode & 0o170000) === 0o100000;
      const isSymlink = (mode & 0o170000) === 0o120000;

      resolve({
        size: stats.size,
        uid: stats.uid,
        gid: stats.gid,
        mode: mode & 0o777,
        atime: stats.atime * 1000,
        mtime: stats.mtime * 1000,
        isDirectory: isDir,
        isFile,
        isSymbolicLink: isSymlink,
        permissions: modeToPermissionsString(mode),
      });
    });
  });
}

/**
 * Reads remote text/code file content (with configurable max byte limit)
 */
export async function sftpReadFile(
  sftp: SFTPWrapper,
  remotePath: string,
  maxBytes: number = 5 * 1024 * 1024 // 5MB limit for inline text editor
): Promise<string> {
  const normalizedPath = remotePath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    const stream = sftp.createReadStream(normalizedPath, { autoClose: true });
    const chunks: Buffer[] = [];
    let totalLength = 0;

    stream.on('data', (chunk: Buffer) => {
      totalLength += chunk.length;
      if (totalLength > maxBytes) {
        stream.destroy();
        return reject(new Error(`File size exceeds editor limit of ${maxBytes / (1024 * 1024)}MB`));
      }
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const fullBuffer = Buffer.concat(chunks);
      resolve(fullBuffer.toString('utf-8'));
    });

    stream.on('error', (err: any) => {
      reject(new Error(`SFTP read failed for '${normalizedPath}': ${err.message}`));
    });
  });
}

/**
 * Writes text content to remote file
 */
export async function sftpWriteFile(
  sftp: SFTPWrapper,
  remotePath: string,
  content: string | Buffer
): Promise<void> {
  const normalizedPath = remotePath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(normalizedPath, { autoClose: true, flags: 'w' });

    stream.on('finish', () => {
      resolve();
    });

    stream.on('error', (err: any) => {
      reject(new Error(`SFTP write failed for '${normalizedPath}': ${err.message}`));
    });

    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    stream.end(buffer);
  });
}

/**
 * Creates remote directory (optionally recursive)
 */
export async function sftpMkdir(
  sftp: SFTPWrapper,
  remotePath: string,
  recursive: boolean = true
): Promise<void> {
  const normalizedPath = remotePath.replace(/\\/g, '/');

  if (!recursive) {
    return new Promise((resolve, reject) => {
      sftp.mkdir(normalizedPath, (err) => {
        if (err) return reject(new Error(`SFTP mkdir failed for '${normalizedPath}': ${err.message}`));
        resolve();
      });
    });
  }

  // Recursive mkdir
  const parts = normalizedPath.split('/').filter(Boolean);
  let currentPath = normalizedPath.startsWith('/') ? '/' : '';

  for (const part of parts) {
    currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.stat(currentPath, (err, stats) => {
          if (!err && stats) {
            return resolve(); // Already exists
          }
          sftp.mkdir(currentPath, (mkErr) => {
            if (mkErr && mkErr.message && !mkErr.message.includes('already exists')) {
              // Ignore failure if already exists
            }
            resolve();
          });
        });
      });
    } catch {
      // Continue next part
    }
  }
}

/**
 * Deletes remote file or directory
 */
export async function sftpDelete(
  sftp: SFTPWrapper,
  remotePath: string,
  isDirectory: boolean = false
): Promise<void> {
  const normalizedPath = remotePath.replace(/\\/g, '/');

  if (!isDirectory) {
    return new Promise((resolve, reject) => {
      sftp.unlink(normalizedPath, (err) => {
        if (err) return reject(new Error(`SFTP unlink failed for '${normalizedPath}': ${err.message}`));
        resolve();
      });
    });
  }

  // Delete directory recursively
  async function removeDirRecursive(dirPath: string): Promise<void> {
    const list = await sftpList(sftp, dirPath);
    for (const item of list) {
      const fullChild = `${dirPath}/${item.filename}`;
      if (item.isDirectory) {
        await removeDirRecursive(fullChild);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(fullChild, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      }
    }
    return new Promise<void>((resolve, reject) => {
      sftp.rmdir(dirPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  return removeDirRecursive(normalizedPath);
}

/**
 * Renames or moves remote file or directory
 */
export async function sftpRename(
  sftp: SFTPWrapper,
  oldPath: string,
  newPath: string
): Promise<void> {
  const normOld = oldPath.replace(/\\/g, '/');
  const normNew = newPath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    sftp.rename(normOld, normNew, (err) => {
      if (err) return reject(new Error(`SFTP rename failed from '${normOld}' to '${normNew}': ${err.message}`));
      resolve();
    });
  });
}

/**
 * Changes permissions of remote file or directory
 */
export async function sftpChmod(
  sftp: SFTPWrapper,
  remotePath: string,
  mode: number | string
): Promise<void> {
  const normalizedPath = remotePath.replace(/\\/g, '/');
  const numericMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;

  return new Promise((resolve, reject) => {
    sftp.chmod(normalizedPath, numericMode, (err) => {
      if (err) return reject(new Error(`SFTP chmod failed for '${normalizedPath}': ${err.message}`));
      resolve();
    });
  });
}

/**
 * Streams an entire remote SFTP directory recursively as a ZIP archive
 */
export async function sftpStreamDirectoryAsZip(
  sftp: SFTPWrapper,
  remoteDirPath: string,
  outputStream: Writable
): Promise<void> {
  const normalizedPath = remoteDirPath.replace(/\\/g, '/');
  const archive = typeof archiver.ZipArchive === 'function'
    ? new archiver.ZipArchive({ zlib: { level: 6 } })
    : (archiver as any)('zip', { zlib: { level: 6 } });

  archive.on('error', (err: any) => {
    try {
      archive.destroy();
    } catch {}
  });

  archive.pipe(outputStream);

  async function traverse(currentDir: string, relativePrefix: string = '') {
    const list = await sftpList(sftp, currentDir);
    for (const item of list) {
      if (item.filename === '.' || item.filename === '..') continue;

      const itemFullPath = `${currentDir.replace(/\/+$/, '')}/${item.filename}`;
      const itemRelPath = relativePrefix ? `${relativePrefix}/${item.filename}` : item.filename;

      if (item.isDirectory) {
        archive.append(Buffer.alloc(0), { name: `${itemRelPath}/` });
        try {
          await traverse(itemFullPath, itemRelPath);
        } catch {
          // Ignore permission errors on subfolders
        }
      } else {
        const fileStream = sftp.createReadStream(itemFullPath);
        archive.append(fileStream, { name: itemRelPath, mode: item.mode });
      }
    }
  }

  await traverse(normalizedPath, '');
  await archive.finalize();
}
