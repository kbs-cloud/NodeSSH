import { SFTPWrapper } from 'ssh2';
import { createSSHConnection, SSHConnectionOptions, SSHConnectionResult } from './connection';
import { SFTPFileEntry, SFTPStat, SFTPStreamZipOptions } from '../types';
import { Readable, Writable } from 'stream';
import path from 'path';
import fs from 'fs';
import { getProfileById } from '../db/profiles';
import * as archiver from 'archiver';

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

  let sftpCommand = options.sftpCommand;
  if (!sftpCommand && options.profileId) {
    const profile = getProfileById(options.userId, options.profileId);
    if (profile?.sftp_command) {
      sftpCommand = profile.sftp_command;
    }
  }

  const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
    if (sftpCommand) {
      sshConn.client.exec(sftpCommand, (err, stream) => {
        if (err) {
          sshConn.client.end();
          if (sshConn.jumpClient) sshConn.jumpClient.end();
          return reject(new Error(`Failed to exec custom SFTP command '${sftpCommand}': ${err.message}`));
        }
        try {
          const SFTPClass = require('ssh2/lib/protocol/SFTP.js')?.SFTP;
          if (!SFTPClass) {
            throw new Error('SFTP protocol class not available');
          }

          let sftpWrapper: any;
          if ((stream as any).incoming && (stream as any).outgoing) {
            sftpWrapper = new SFTPClass(sshConn.client, {
              type: 'session',
              incoming: (stream as any).incoming,
              outgoing: (stream as any).outgoing,
            });
            if ((sshConn.client as any)._chanMgr && (stream as any).incoming) {
              (sshConn.client as any)._chanMgr.update((stream as any).incoming.id, sftpWrapper);
            }
          } else {
            sftpWrapper = new SFTPClass(stream);
          }

          const onReady = () => {
            removeListeners();
            resolve(sftpWrapper as SFTPWrapper);
          };
          const onError = (error: any) => {
            removeListeners();
            sshConn.client.end();
            if (sshConn.jumpClient) sshConn.jumpClient.end();
            reject(new Error(`SFTP error: ${error.message}`));
          };
          const onExit = (code: any) => {
            removeListeners();
            sshConn.client.end();
            if (sshConn.jumpClient) sshConn.jumpClient.end();
            reject(new Error(`SFTP process exited with code ${code}`));
          };
          function removeListeners() {
            sftpWrapper.removeListener('ready', onReady);
            sftpWrapper.removeListener('error', onError);
            sftpWrapper.removeListener('exit', onExit);
            sftpWrapper.removeListener('close', onExit);
          }

          sftpWrapper.on('ready', onReady)
            .on('error', onError)
            .on('exit', onExit)
            .on('close', onExit);

          if (typeof sftpWrapper._init === 'function') {
            sftpWrapper._init();
          }
        } catch (wrapperErr: any) {
          sshConn.client.end();
          if (sshConn.jumpClient) sshConn.jumpClient.end();
          reject(new Error(`Failed to instantiate SFTPWrapper: ${wrapperErr.message}`));
        }
      });
    } else {
      sshConn.client.sftp((err, sftpWrapper) => {
        if (err) {
          sshConn.client.end();
          if (sshConn.jumpClient) sshConn.jumpClient.end();
          return reject(new Error(`Failed to open SFTP subsystem: ${err.message}`));
        }
        resolve(sftpWrapper);
      });
    }
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
 * Resolves the canonical absolute path for a given remote path (e.g. '.' -> '/home/username')
 */
export async function sftpRealPath(sftp: SFTPWrapper, remotePath: string = '.'): Promise<string> {
  return new Promise((resolve) => {
    sftp.realpath(remotePath, (err, absPath) => {
      if (err || !absPath) {
        return resolve(remotePath === '.' ? '/' : remotePath);
      }
      resolve(absPath.replace(/\\/g, '/'));
    });
  });
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
        if (err) {
          const msg = err.message || '';
          if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('eexist')) {
            return resolve();
          }
          return reject(new Error(`SFTP mkdir failed for '${normalizedPath}': ${err.message}`));
        }
        resolve();
      });
    });
  }

  // Recursive mkdir
  const parts = normalizedPath.split('/').filter(Boolean);
  let currentPath = normalizedPath.startsWith('/') ? '/' : '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

    await new Promise<void>((resolve, reject) => {
      sftp.stat(currentPath, (err, stats) => {
        if (!err && stats) {
          // Folder/item already exists
          return resolve();
        }

        sftp.mkdir(currentPath, (mkErr) => {
          if (mkErr) {
            const msg = mkErr.message || '';
            if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('eexist')) {
              return resolve();
            }
            return reject(new Error(`SFTP mkdir failed for '${currentPath}': ${mkErr.message}`));
          }
          resolve();
        });
      });
    });
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
  outputStream: Writable,
  options?: SFTPStreamZipOptions
): Promise<void> {
  const normalizedPath = remoteDirPath.replace(/\\/g, '/');
  const ZipConstructor = (archiver as any).ZipArchive || (archiver as any).default?.ZipArchive || (archiver as any).default;
  const archive = typeof ZipConstructor === 'function' && ZipConstructor.prototype && ZipConstructor.prototype.append
    ? new ZipConstructor({ zlib: { level: 6 } })
    : (typeof ZipConstructor === 'function' ? ZipConstructor('zip', { zlib: { level: 6 } }) : new (archiver as any).ZipArchive({ zlib: { level: 6 } }));

  let activeReadStream: Readable | null = null;
  let aborted = false;

  let exploredDirs = 0;
  let exploredFiles = 0;
  let totalDiscoveredBytes = 0;
  let processedFiles = 0;
  let processedBytes = 0;
  let currentFile: string | undefined = undefined;

  const emitProgress = (phase: 'exploring' | 'transferring' | 'completed' | 'aborted') => {
    if (!options?.onProgress) return;
    let percent = 0;
    if (phase === 'completed') {
      percent = 100;
    } else if (totalDiscoveredBytes > 0) {
      percent = Math.min(99, Math.round((processedBytes / totalDiscoveredBytes) * 100));
    } else if (exploredFiles > 0) {
      percent = Math.min(99, Math.round((processedFiles / exploredFiles) * 100));
    }
    try {
      options.onProgress({
        phase,
        currentFile,
        exploredFiles,
        exploredDirs,
        processedFiles,
        processedBytes,
        totalDiscoveredBytes,
        percent,
      });
    } catch {}
  };

  const onAbort = () => {
    aborted = true;
    try {
      if (activeReadStream) {
        activeReadStream.destroy();
      }
    } catch {}
    try {
      archive.destroy();
    } catch {}
    emitProgress('aborted');
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      onAbort();
      throw new Error('Transfer aborted');
    }
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  archive.on('error', (err: any) => {
    try {
      archive.destroy();
    } catch {}
  });

  const finishPromise = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve());
    archive.on('finish', () => resolve());
    archive.on('error', (err: any) => reject(err));
    outputStream.on('finish', () => resolve());
    outputStream.on('error', (err: any) => reject(err));
  });

  archive.pipe(outputStream);

  async function traverse(currentDir: string, relativePrefix: string = '') {
    if (aborted || options?.signal?.aborted) {
      throw new Error('Transfer aborted');
    }

    exploredDirs += 1;
    emitProgress('exploring');

    const list = await sftpList(sftp, currentDir);
    for (const item of list) {
      if (aborted || options?.signal?.aborted) {
        throw new Error('Transfer aborted');
      }
      if (item.filename === '.' || item.filename === '..') continue;

      const itemFullPath = `${currentDir.replace(/\/+$/, '')}/${item.filename}`;
      const itemRelPath = relativePrefix ? `${relativePrefix}/${item.filename}` : item.filename;

      if (item.isDirectory) {
        archive.append(Buffer.alloc(0), { name: `${itemRelPath}/` });
        try {
          await traverse(itemFullPath, itemRelPath);
        } catch (err: any) {
          if (aborted || options?.signal?.aborted) throw err;
          // Ignore permission errors on subfolders
        }
      } else {
        if (aborted || options?.signal?.aborted) {
          throw new Error('Transfer aborted');
        }

        exploredFiles += 1;
        totalDiscoveredBytes += item.size || 0;
        currentFile = itemRelPath;
        emitProgress('transferring');

        await new Promise<void>((resolveFile, rejectFile) => {
          if (aborted || options?.signal?.aborted) {
            return rejectFile(new Error('Transfer aborted'));
          }

          const readStream = sftp.createReadStream(itemFullPath);
          activeReadStream = readStream;

          readStream.on('data', (chunk: Buffer) => {
            processedBytes += chunk.length;
            emitProgress('transferring');
          });

          const cleanup = () => {
            if (activeReadStream === readStream) {
              activeReadStream = null;
            }
          };

          const handleFileAbort = () => {
            try {
              readStream.destroy();
            } catch {}
            cleanup();
            rejectFile(new Error('Transfer aborted'));
          };

          if (options?.signal) {
            options.signal.addEventListener('abort', handleFileAbort, { once: true });
          }

          let isSettled = false;

          readStream.on('error', (err: any) => {
            if (isSettled) return;
            isSettled = true;
            if (options?.signal) {
              options.signal.removeEventListener('abort', handleFileAbort);
            }
            cleanup();
            if (aborted || options?.signal?.aborted) {
              return rejectFile(new Error('Transfer aborted'));
            }
            // Ignore unreadable individual files (e.g. permission denied) and proceed
            processedFiles += 1;
            emitProgress('transferring');
            resolveFile();
          });

          const onEntry = (entry: any) => {
            if (entry && entry.name === itemRelPath) {
              if (isSettled) return;
              isSettled = true;
              archive.removeListener('entry', onEntry);
              if (options?.signal) {
                options.signal.removeEventListener('abort', handleFileAbort);
              }
              cleanup();
              processedFiles += 1;
              emitProgress('transferring');
              resolveFile();
            }
          };

          archive.on('entry', onEntry);

          try {
            archive.append(readStream, { name: itemRelPath, mode: item.mode });
          } catch (err: any) {
            if (isSettled) return;
            isSettled = true;
            archive.removeListener('entry', onEntry);
            if (options?.signal) {
              options.signal.removeEventListener('abort', handleFileAbort);
            }
            cleanup();
            if (aborted || options?.signal?.aborted) {
              return rejectFile(new Error('Transfer aborted'));
            }
            processedFiles += 1;
            emitProgress('transferring');
            resolveFile();
          }
        });
      }
    }
  }

  try {
    await traverse(normalizedPath, '');
    if (aborted || options?.signal?.aborted) {
      throw new Error('Transfer aborted');
    }
    await archive.finalize();
    await finishPromise;
    emitProgress('completed');
  } finally {
    if (options?.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Extracts remote archive (.tar.gz, .tgz, .tar.bz2, .tbz2, .tar.xz, .txz, .zip, .tar)
 */
export async function sftpRemoteExtract(
  sshConn: SSHConnectionResult,
  archivePath: string,
  targetDir?: string
): Promise<{ stdout: string; stderr: string }> {
  const normPath = archivePath.replace(/\\/g, '/');
  const lower = normPath.toLowerCase();

  let cmd: string;
  const escapedPath = normPath.replace(/"/g, '\\"');
  const escapedDest = targetDir ? targetDir.replace(/\\/g, '/').replace(/"/g, '\\"') : '';

  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    cmd = escapedDest
      ? `mkdir -p "${escapedDest}" && tar -xzf "${escapedPath}" -C "${escapedDest}"`
      : `tar -xzf "${escapedPath}"`;
  } else if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) {
    cmd = escapedDest
      ? `mkdir -p "${escapedDest}" && tar -xjf "${escapedPath}" -C "${escapedDest}"`
      : `tar -xjf "${escapedPath}"`;
  } else if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) {
    cmd = escapedDest
      ? `mkdir -p "${escapedDest}" && tar -xJf "${escapedPath}" -C "${escapedDest}"`
      : `tar -xJf "${escapedPath}"`;
  } else if (lower.endsWith('.zip')) {
    cmd = escapedDest
      ? `mkdir -p "${escapedDest}" && unzip -o "${escapedPath}" -d "${escapedDest}"`
      : `unzip -o "${escapedPath}"`;
  } else if (lower.endsWith('.tar')) {
    cmd = escapedDest
      ? `mkdir -p "${escapedDest}" && tar -xf "${escapedPath}" -C "${escapedDest}"`
      : `tar -xf "${escapedPath}"`;
  } else {
    // Default fallback to tar -xf
    cmd = escapedDest
      ? `mkdir -p "${escapedDest}" && tar -xf "${escapedPath}" -C "${escapedDest}"`
      : `tar -xf "${escapedPath}"`;
  }

  return new Promise((resolve, reject) => {
    sshConn.client.exec(cmd, (err, stream) => {
      if (err) return reject(new Error(`Failed to execute remote extraction: ${err.message}`));

      let stdout = '';
      let stderr = '';

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      stream.on('close', (code: number) => {
        if (code !== 0 && code !== null) {
          return reject(
            new Error(`Remote extraction failed (exit code ${code}): ${stderr.trim() || stdout.trim() || 'Unknown error'}`)
          );
        }
        resolve({ stdout, stderr });
      });

      stream.on('error', (streamErr: any) => {
        reject(new Error(`Extraction stream error: ${streamErr.message}`));
      });
    });
  });
}

/**
 * Creates remote compressed archive from source paths
 */
export async function sftpRemoteCompress(
  sshConn: SSHConnectionResult,
  sourcePaths: string[],
  targetArchive: string
): Promise<{ stdout: string; stderr: string }> {
  if (!sourcePaths || sourcePaths.length === 0) {
    throw new Error('At least one source path is required for compression');
  }

  const normTarget = targetArchive.replace(/\\/g, '/');
  const escapedTarget = normTarget.replace(/"/g, '\\"');
  const targetDir = path.posix.dirname(normTarget);
  const escapedTargetDir = targetDir.replace(/"/g, '\\"');

  const quotedSources = sourcePaths
    .map((p) => `"${p.replace(/\\/g, '/').replace(/"/g, '\\"')}"`)
    .join(' ');

  let cmd: string;
  if (normTarget.toLowerCase().endsWith('.zip')) {
    cmd = `mkdir -p "${escapedTargetDir}" && zip -r "${escapedTarget}" ${quotedSources}`;
  } else {
    cmd = `mkdir -p "${escapedTargetDir}" && tar -czf "${escapedTarget}" ${quotedSources}`;
  }

  return new Promise((resolve, reject) => {
    sshConn.client.exec(cmd, (err, stream) => {
      if (err) return reject(new Error(`Failed to execute remote compression: ${err.message}`));

      let stdout = '';
      let stderr = '';

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      stream.on('close', (code: number) => {
        if (code !== 0 && code !== null) {
          return reject(
            new Error(`Remote compression failed (exit code ${code}): ${stderr.trim() || stdout.trim() || 'Unknown error'}`)
          );
        }
        resolve({ stdout, stderr });
      });

      stream.on('error', (streamErr: any) => {
        reject(new Error(`Compression stream error: ${streamErr.message}`));
      });
    });
  });
}

export interface SFTPDirectDownloadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: {
    phase: 'exploring' | 'transferring' | 'completed' | 'aborted';
    currentFile?: string;
    exploredFiles: number;
    exploredDirs: number;
    processedFiles: number;
    processedBytes: number;
    totalDiscoveredBytes: number;
    percent: number;
  }) => void;
}

/**
 * Downloads a single remote file directly to a local disk path (one file at a time, no compression)
 * Automatically cleans up / deletes the local partial file if aborted or error occurs.
 */
export async function sftpDownloadFileDirect(
  sftp: SFTPWrapper,
  remoteFilePath: string,
  localTargetPath: string,
  options?: SFTPDirectDownloadOptions
): Promise<void> {
  const normRemote = remoteFilePath.replace(/\\/g, '/');
  const localDir = path.dirname(localTargetPath);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  let activeReadStream: Readable | null = null;
  let activeWriteStream: fs.WriteStream | null = null;
  let aborted = false;

  return new Promise<void>((resolve, reject) => {
    let isSettled = false;
    let isCompleted = false;

    if (options?.signal?.aborted) {
      isSettled = true;
      return reject(new Error('Transfer aborted'));
    }

    const readStream = sftp.createReadStream(normRemote);
    const writeStream = fs.createWriteStream(localTargetPath);
    activeReadStream = readStream;
    activeWriteStream = writeStream;

    let processedBytes = 0;

    readStream.on('data', (chunk: Buffer) => {
      if (isSettled) return;
      processedBytes += chunk.length;
      if (options?.onProgress) {
        options.onProgress({
          phase: 'transferring',
          currentFile: path.basename(localTargetPath),
          exploredFiles: 1,
          exploredDirs: 0,
          processedFiles: 0,
          processedBytes,
          totalDiscoveredBytes: 0,
          percent: 0,
        });
      }
    });

    const cleanup = () => {
      activeReadStream = null;
      activeWriteStream = null;
    };

    const handleAbort = () => {
      if (isSettled || isCompleted) return;
      isSettled = true;
      aborted = true;
      try { readStream.destroy(); } catch {}
      try { writeStream.destroy(); } catch {}
      if (!isCompleted) {
        try {
          if (fs.existsSync(localTargetPath)) {
            fs.unlinkSync(localTargetPath);
          }
        } catch {}
      }
      cleanup();
      reject(new Error('Transfer aborted'));
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        handleAbort();
        return;
      }
      options.signal.addEventListener('abort', handleAbort, { once: true });
    }

    readStream.on('error', (err: any) => {
      if (isSettled || isCompleted) return;
      isSettled = true;
      if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
      try { writeStream.destroy(); } catch {}
      if (!isCompleted) {
        try {
          if (fs.existsSync(localTargetPath)) {
            fs.unlinkSync(localTargetPath);
          }
        } catch {}
      }
      cleanup();
      reject(new Error(`SFTP read failed: ${err.message}`));
    });

    writeStream.on('error', (err: any) => {
      if (isSettled || isCompleted) return;
      isSettled = true;
      if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
      try { readStream.destroy(); } catch {}
      if (!isCompleted) {
        try {
          if (fs.existsSync(localTargetPath)) {
            fs.unlinkSync(localTargetPath);
          }
        } catch {}
      }
      cleanup();
      reject(new Error(`Local file write failed: ${err.message}`));
    });

    writeStream.on('finish', () => {
      if (isSettled) return;
      isSettled = true;
      isCompleted = true;
      if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
      cleanup();
      if (options?.onProgress) {
        options.onProgress({
          phase: 'completed',
          currentFile: path.basename(localTargetPath),
          exploredFiles: 1,
          exploredDirs: 0,
          processedFiles: 1,
          processedBytes,
          totalDiscoveredBytes: processedBytes,
          percent: 100,
        });
      }
      resolve();
    });

    readStream.pipe(writeStream);
  });
}

/**
 * Downloads an entire remote directory structure recursively directly onto local disk
 * Creates folders and copies each file individually (one file at a time, no zip compression).
 * Automatically cleans up only in-flight partial files if aborted.
 */
export async function sftpDownloadDirectoryDirect(
  sftp: SFTPWrapper,
  remoteDirPath: string,
  localTargetDir: string,
  options?: SFTPDirectDownloadOptions
): Promise<void> {
  const normRemoteDir = remoteDirPath.replace(/\\/g, '/');
  if (!fs.existsSync(localTargetDir)) {
    fs.mkdirSync(localTargetDir, { recursive: true });
  }

  let exploredDirs = 0;
  let exploredFiles = 0;
  let totalDiscoveredBytes = 0;
  let processedFiles = 0;
  let processedBytes = 0;
  let currentFile: string | undefined = undefined;
  let activeInFlightFilePath: string | null = null;
  let activeReadStream: Readable | null = null;
  let activeWriteStream: fs.WriteStream | null = null;
  let aborted = false;

  const emitProgress = (phase: 'exploring' | 'transferring' | 'completed' | 'aborted') => {
    if (!options?.onProgress) return;
    let percent = 0;
    if (phase === 'completed') {
      percent = 100;
    } else if (totalDiscoveredBytes > 0) {
      percent = Math.min(99, Math.round((processedBytes / totalDiscoveredBytes) * 100));
    } else if (exploredFiles > 0) {
      percent = Math.min(99, Math.round((processedFiles / exploredFiles) * 100));
    }
    try {
      options.onProgress({
        phase,
        currentFile,
        exploredFiles,
        exploredDirs,
        processedFiles,
        processedBytes,
        totalDiscoveredBytes,
        percent,
      });
    } catch {}
  };

  const onAbort = () => {
    aborted = true;
    try { if (activeReadStream) activeReadStream.destroy(); } catch {}
    try { if (activeWriteStream) activeWriteStream.destroy(); } catch {}
    emitProgress('aborted');
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      onAbort();
      throw new Error('Transfer aborted');
    }
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  async function traverseAndDownload(currentRemote: string, currentLocal: string, relPrefix: string = '') {
    if (aborted || options?.signal?.aborted) {
      throw new Error('Transfer aborted');
    }

    exploredDirs += 1;
    if (!fs.existsSync(currentLocal)) {
      fs.mkdirSync(currentLocal, { recursive: true });
    }
    emitProgress('exploring');

    const list = await sftpList(sftp, currentRemote);
    for (const item of list) {
      if (aborted || options?.signal?.aborted) {
        throw new Error('Transfer aborted');
      }
      if (item.filename === '.' || item.filename === '..') continue;

      const itemRemotePath = `${currentRemote.replace(/\/+$/, '')}/${item.filename}`;
      const itemLocalPath = path.join(currentLocal, item.filename);
      const itemRelPath = relPrefix ? `${relPrefix}/${item.filename}` : item.filename;

      if (item.isDirectory) {
        if (!fs.existsSync(itemLocalPath)) {
          fs.mkdirSync(itemLocalPath, { recursive: true });
        }
        await traverseAndDownload(itemRemotePath, itemLocalPath, itemRelPath);
      } else {
        if (aborted || options?.signal?.aborted) {
          throw new Error('Transfer aborted');
        }

        exploredFiles += 1;
        totalDiscoveredBytes += item.size || 0;
        currentFile = itemRelPath;
        activeInFlightFilePath = itemLocalPath;
        emitProgress('transferring');

        await new Promise<void>((resolveFile, rejectFile) => {
          let isSettled = false;
          let isFileCompleted = false;

          if (aborted || options?.signal?.aborted) {
            return rejectFile(new Error('Transfer aborted'));
          }

          const readStream = sftp.createReadStream(itemRemotePath);
          const writeStream = fs.createWriteStream(itemLocalPath);
          activeReadStream = readStream;
          activeWriteStream = writeStream;

          readStream.on('data', (chunk: Buffer) => {
            processedBytes += chunk.length;
            emitProgress('transferring');
          });

          const cleanup = () => {
            activeReadStream = null;
            activeWriteStream = null;
            activeInFlightFilePath = null;
          };

          const handleFileAbort = () => {
            if (isSettled || isFileCompleted) return;
            isSettled = true;
            try { readStream.destroy(); } catch {}
            try { writeStream.destroy(); } catch {}
            if (!isFileCompleted) {
              try {
                if (fs.existsSync(itemLocalPath)) {
                  fs.unlinkSync(itemLocalPath);
                }
              } catch {}
            }
            cleanup();
            rejectFile(new Error('Transfer aborted'));
          };

          if (options?.signal) {
            if (options.signal.aborted) {
              handleFileAbort();
              return;
            }
            options.signal.addEventListener('abort', handleFileAbort, { once: true });
          }

          readStream.on('error', (err: any) => {
            if (isSettled || isFileCompleted) return;
            isSettled = true;
            if (options?.signal) options.signal.removeEventListener('abort', handleFileAbort);
            try { writeStream.destroy(); } catch {}
            if (!isFileCompleted) {
              try {
                if (fs.existsSync(itemLocalPath)) fs.unlinkSync(itemLocalPath);
              } catch {}
            }
            cleanup();
            if (aborted || options?.signal?.aborted) {
              return rejectFile(new Error('Transfer aborted'));
            }
            // Skip unreadable files and continue
            processedFiles += 1;
            emitProgress('transferring');
            resolveFile();
          });

          writeStream.on('error', (err: any) => {
            if (isSettled || isFileCompleted) return;
            isSettled = true;
            if (options?.signal) options.signal.removeEventListener('abort', handleFileAbort);
            try { readStream.destroy(); } catch {}
            if (!isFileCompleted) {
              try {
                if (fs.existsSync(itemLocalPath)) fs.unlinkSync(itemLocalPath);
              } catch {}
            }
            cleanup();
            if (aborted || options?.signal?.aborted) {
              return rejectFile(new Error('Transfer aborted'));
            }
            processedFiles += 1;
            emitProgress('transferring');
            resolveFile();
          });

          writeStream.on('finish', () => {
            if (isSettled) return;
            isSettled = true;
            isFileCompleted = true;
            if (options?.signal) options.signal.removeEventListener('abort', handleFileAbort);
            cleanup();
            processedFiles += 1;
            emitProgress('transferring');
            resolveFile();
          });

          readStream.pipe(writeStream);
        });
      }
    }
  }

  try {
    await traverseAndDownload(normRemoteDir, localTargetDir, '');
    if (aborted || options?.signal?.aborted) {
      throw new Error('Transfer aborted');
    }
    emitProgress('completed');
  } finally {
    if (options?.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Streams a single file or entire directory structure directly between two SFTP sessions (Remote-to-Remote)
 */
export async function sftpTransferBetweenSessions(
  srcSftp: SFTPWrapper,
  srcPath: string,
  destSftp: SFTPWrapper,
  destDir: string,
  options?: SFTPDirectDownloadOptions
): Promise<void> {
  const normSrc = srcPath.replace(/\\/g, '/');
  const baseName = path.posix.basename(normSrc);
  const targetPath = `${destDir.replace(/\/+$/, '')}/${baseName}`;

  const stat = await sftpStat(srcSftp, normSrc);

  let exploredDirs = 0;
  let exploredFiles = 0;
  let totalDiscoveredBytes = 0;
  let processedFiles = 0;
  let processedBytes = 0;
  let currentFile: string | undefined = undefined;
  let activeReadStream: Readable | null = null;
  let activeWriteStream: Writable | null = null;
  let aborted = false;

  const emitProgress = (phase: 'exploring' | 'transferring' | 'completed' | 'aborted') => {
    if (!options?.onProgress) return;
    let percent = 0;
    if (phase === 'completed') {
      percent = 100;
    } else if (totalDiscoveredBytes > 0) {
      percent = Math.min(99, Math.round((processedBytes / totalDiscoveredBytes) * 100));
    } else if (exploredFiles > 0) {
      percent = Math.min(99, Math.round((processedFiles / exploredFiles) * 100));
    }
    try {
      options.onProgress({
        phase,
        currentFile,
        exploredFiles,
        exploredDirs,
        processedFiles,
        processedBytes,
        totalDiscoveredBytes,
        percent,
      });
    } catch {}
  };

  const onAbort = () => {
    aborted = true;
    try { if (activeReadStream) activeReadStream.destroy(); } catch {}
    try { if (activeWriteStream) (activeWriteStream as any).destroy?.(); } catch {}
    emitProgress('aborted');
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      onAbort();
      throw new Error('Transfer aborted');
    }
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  async function transferSingleFile(remoteSrc: string, remoteDest: string, fileSize: number, relName: string) {
    exploredFiles += 1;
    totalDiscoveredBytes += fileSize;
    currentFile = relName;
    emitProgress('transferring');

    const parentDir = path.posix.dirname(remoteDest.replace(/\\/g, '/'));
    if (parentDir && parentDir !== '.' && parentDir !== '/') {
      await sftpMkdir(destSftp, parentDir, true).catch(() => {});
    }

    await new Promise<void>((resolve, reject) => {
      if (aborted || options?.signal?.aborted) return reject(new Error('Transfer aborted'));

      const rStream = srcSftp.createReadStream(remoteSrc);
      const wStream = destSftp.createWriteStream(remoteDest);
      activeReadStream = rStream;
      activeWriteStream = wStream;

      rStream.on('data', (chunk: Buffer) => {
        processedBytes += chunk.length;
        emitProgress('transferring');
      });

      const cleanup = () => {
        activeReadStream = null;
        activeWriteStream = null;
      };

      const handleAbort = () => {
        try { rStream.destroy(); } catch {}
        try { (wStream as any).destroy?.(); } catch {}
        cleanup();
        reject(new Error('Transfer aborted'));
      };

      if (options?.signal) {
        if (options.signal.aborted) {
          handleAbort();
          return;
        }
        options.signal.addEventListener('abort', handleAbort, { once: true });
      }

      let isSettled = false;

      rStream.on('error', (err: any) => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        try { (wStream as any).destroy?.(); } catch {}
        cleanup();
        reject(new Error(`SFTP read error: ${err.message}`));
      });

      wStream.on('error', (err: any) => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        try { rStream.destroy(); } catch {}
        cleanup();
        reject(new Error(`SFTP write error: ${err.message}`));
      });

      wStream.on('finish', () => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        cleanup();
        processedFiles += 1;
        emitProgress('transferring');
        resolve();
      });

      wStream.on('close', () => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        cleanup();
        processedFiles += 1;
        emitProgress('transferring');
        resolve();
      });

      rStream.pipe(wStream);
    });
  }

  async function traverseAndTransferDir(currSrc: string, currDest: string, relPrefix: string = '') {
    exploredDirs += 1;
    await sftpMkdir(destSftp, currDest, true).catch(() => {});
    emitProgress('exploring');

    const items = await sftpList(srcSftp, currSrc);
    for (const item of items) {
      if (aborted || options?.signal?.aborted) throw new Error('Transfer aborted');
      if (item.filename === '.' || item.filename === '..') continue;

      const itemSrc = `${currSrc.replace(/\/+$/, '')}/${item.filename}`;
      const itemDest = `${currDest.replace(/\/+$/, '')}/${item.filename}`;
      const itemRel = relPrefix ? `${relPrefix}/${item.filename}` : item.filename;

      if (item.isDirectory) {
        await sftpMkdir(destSftp, itemDest, true).catch(() => {});
        await traverseAndTransferDir(itemSrc, itemDest, itemRel);
      } else {
        await transferSingleFile(itemSrc, itemDest, item.size || 0, itemRel);
      }
    }
  }

  try {
    if (stat.isDirectory) {
      await traverseAndTransferDir(normSrc, targetPath, baseName);
    } else {
      await transferSingleFile(normSrc, targetPath, stat.size || 0, baseName);
    }
    emitProgress('completed');
  } finally {
    if (options?.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Transfers local files/folders to remote SFTP
 */
export async function sftpTransferLocalToRemote(
  localSrcPath: string,
  destSftp: SFTPWrapper,
  destDir: string,
  options?: SFTPDirectDownloadOptions
): Promise<void> {
  const normLocal = path.resolve(localSrcPath);
  const baseName = path.basename(normLocal);
  const targetRemote = `${destDir.replace(/\/+$/, '')}/${baseName}`;
  const stat = fs.statSync(normLocal);

  let exploredDirs = 0;
  let exploredFiles = 0;
  let totalDiscoveredBytes = 0;
  let processedFiles = 0;
  let processedBytes = 0;
  let currentFile: string | undefined = undefined;
  let activeReadStream: Readable | null = null;
  let activeWriteStream: Writable | null = null;
  let aborted = false;

  const emitProgress = (phase: 'exploring' | 'transferring' | 'completed' | 'aborted') => {
    if (!options?.onProgress) return;
    let percent = 0;
    if (phase === 'completed') {
      percent = 100;
    } else if (totalDiscoveredBytes > 0) {
      percent = Math.min(99, Math.round((processedBytes / totalDiscoveredBytes) * 100));
    } else if (exploredFiles > 0) {
      percent = Math.min(99, Math.round((processedFiles / exploredFiles) * 100));
    }
    try {
      options.onProgress({
        phase,
        currentFile,
        exploredFiles,
        exploredDirs,
        processedFiles,
        processedBytes,
        totalDiscoveredBytes,
        percent,
      });
    } catch {}
  };

  const onAbort = () => {
    aborted = true;
    try { if (activeReadStream) activeReadStream.destroy(); } catch {}
    try { if (activeWriteStream) (activeWriteStream as any).destroy?.(); } catch {}
    emitProgress('aborted');
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      onAbort();
      throw new Error('Transfer aborted');
    }
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  async function uploadFile(lPath: string, rPath: string, fileSize: number, relName: string) {
    exploredFiles += 1;
    totalDiscoveredBytes += fileSize;
    currentFile = relName;
    emitProgress('transferring');

    const parentDir = path.posix.dirname(rPath.replace(/\\/g, '/'));
    if (parentDir && parentDir !== '.' && parentDir !== '/') {
      await sftpMkdir(destSftp, parentDir, true).catch(() => {});
    }

    await new Promise<void>((resolve, reject) => {
      if (aborted || options?.signal?.aborted) return reject(new Error('Transfer aborted'));

      const rStream = fs.createReadStream(lPath);
      const wStream = destSftp.createWriteStream(rPath);
      activeReadStream = rStream;
      activeWriteStream = wStream;

      rStream.on('data', (chunk: Buffer) => {
        processedBytes += chunk.length;
        emitProgress('transferring');
      });

      const cleanup = () => {
        activeReadStream = null;
        activeWriteStream = null;
      };

      const handleAbort = () => {
        try { rStream.destroy(); } catch {}
        try { (wStream as any).destroy?.(); } catch {}
        cleanup();
        reject(new Error('Transfer aborted'));
      };

      if (options?.signal) {
        if (options.signal.aborted) {
          handleAbort();
          return;
        }
        options.signal.addEventListener('abort', handleAbort, { once: true });
      }

      let isSettled = false;

      rStream.on('error', (err: any) => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        try { (wStream as any).destroy?.(); } catch {}
        cleanup();
        reject(new Error(`Local read error: ${err.message}`));
      });

      wStream.on('error', (err: any) => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        try { rStream.destroy(); } catch {}
        cleanup();
        reject(new Error(`SFTP upload write error: ${err.message}`));
      });

      wStream.on('finish', () => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        cleanup();
        processedFiles += 1;
        emitProgress('transferring');
        resolve();
      });

      wStream.on('close', () => {
        if (isSettled) return;
        isSettled = true;
        if (options?.signal) options.signal.removeEventListener('abort', handleAbort);
        cleanup();
        processedFiles += 1;
        emitProgress('transferring');
        resolve();
      });

      rStream.pipe(wStream);
    });
  }

  async function traverseDir(currLocal: string, currRemote: string, relPrefix: string = '') {
    exploredDirs += 1;
    await sftpMkdir(destSftp, currRemote, true).catch(() => {});
    emitProgress('exploring');

    const entries = fs.readdirSync(currLocal, { withFileTypes: true });
    for (const entry of entries) {
      if (aborted || options?.signal?.aborted) throw new Error('Transfer aborted');
      const itemLocal = path.join(currLocal, entry.name);
      const itemRemote = `${currRemote.replace(/\/+$/, '')}/${entry.name}`;
      const itemRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await sftpMkdir(destSftp, itemRemote, true).catch(() => {});
        await traverseDir(itemLocal, itemRemote, itemRel);
      } else {
        const itemStat = fs.statSync(itemLocal);
        await uploadFile(itemLocal, itemRemote, itemStat.size, itemRel);
      }
    }
  }

  try {
    if (stat.isDirectory()) {
      await traverseDir(normLocal, targetRemote, baseName);
    } else {
      await uploadFile(normLocal, targetRemote, stat.size, baseName);
    }
    emitProgress('completed');
  } finally {
    if (options?.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

