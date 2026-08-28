import { app } from 'electron';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Resolves the target directory where the user dropped a file/folder.
 * Supports Windows (IShellWindows / Explorer), macOS (Finder), and Linux (Desktop/Downloads fallback).
 */
export async function resolveDropTargetDirectory(): Promise<string> {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      return await resolveWindowsExplorerPath();
    } else if (platform === 'darwin') {
      return await resolveMacFinderPath();
    } else if (platform === 'linux') {
      return await resolveLinuxFileManagerPath();
    }
  } catch (err: any) {
    console.warn('[DropTargetResolver] Failed to resolve active window path:', err.message);
  }

  return getFallbackDirectory();
}

/**
 * Fallback directory (User Desktop, Downloads, or Home)
 */
export function getFallbackDirectory(): string {
  try {
    const desktop = app?.getPath('desktop');
    if (desktop && fs.existsSync(desktop)) return desktop;
  } catch {}

  try {
    const downloads = app?.getPath('downloads');
    if (downloads && fs.existsSync(downloads)) return downloads;
  } catch {}

  const home = os.homedir();
  const desktop = path.join(home, 'Desktop');
  if (fs.existsSync(desktop)) return desktop;

  const downloads = path.join(home, 'Downloads');
  if (fs.existsSync(downloads)) return downloads;

  return home;
}

/**
 * Windows: Queries active Windows Explorer window via Shell.Application COM or falls back to Desktop.
 */
function resolveWindowsExplorerPath(): Promise<string> {
  return new Promise((resolve) => {
    const psScript = `
$shell = New-Object -ComObject Shell.Application
$active = $shell.Windows() | Where-Object { $_.Name -match 'Explorer' } | Select-Object -First 1
if ($active -and $active.Document -and $active.Document.Folder) {
  $active.Document.Folder.Self.Path
} else {
  [Environment]::GetFolderPath('Desktop')
}
`.trim();

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 1500 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const resolvedPath = stdout.trim().split('\r\n')[0].trim();
        if (fs.existsSync(resolvedPath)) {
          return resolve(resolvedPath);
        }
      }
      resolve(getFallbackDirectory());
    });
  });
}

/**
 * macOS: Queries active Finder window target folder via AppleScript or falls back to Desktop.
 */
function resolveMacFinderPath(): Promise<string> {
  return new Promise((resolve) => {
    const script = `osascript -e 'tell application "Finder" to if (count of Finder windows) > 0 then return POSIX path of (target of front window as alias) else return POSIX path of (path to desktop folder)'`;
    exec(script, { timeout: 1500 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const resolvedPath = stdout.trim();
        if (fs.existsSync(resolvedPath)) {
          return resolve(resolvedPath);
        }
      }
      resolve(getFallbackDirectory());
    });
  });
}

/**
 * Linux: Queries active file manager or falls back to Desktop / Downloads.
 */
function resolveLinuxFileManagerPath(): Promise<string> {
  return new Promise((resolve) => {
    const home = os.homedir();
    const desktop = path.join(home, 'Desktop');
    if (fs.existsSync(desktop)) {
      return resolve(desktop);
    }
    resolve(getFallbackDirectory());
  });
}
