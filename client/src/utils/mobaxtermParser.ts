import { ServerProfile } from '../types';

/**
 * Parses MobaXterm `.mxtsessions` or `.ini` file contents into NodeSSH ServerProfile list
 */
export function parseMobaXtermSessions(iniContent: string): Partial<ServerProfile>[] {
  const profiles: Partial<ServerProfile>[] = [];
  const lines = iniContent.split(/\r?\n/);
  
  let currentFolder = 'MobaXterm Imported';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('SubRep=')) {
      const folderVal = trimmed.replace('SubRep=', '').trim();
      if (folderVal) {
        currentFolder = folderVal.replace(/\\/g, '/');
      }
      continue;
    }

    // Check for session line e.g. SessionName=#109#0%hostname%port%username%...
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const name = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();

      // Check if it's SSH session (MobaXterm uses #109# for SSH)
      if (val.startsWith('#109#') || val.includes('%')) {
        const parts = val.replace(/^#\d+#/, '').split('%');
        if (parts.length >= 4) {
          const host = parts[1] || '';
          const port = parseInt(parts[2], 10) || 22;
          const username = parts[3] || 'root';

          if (host) {
            profiles.push({
              name,
              host,
              port,
              username,
              folder: currentFolder,
              authType: 'password',
              tags: ['MobaXterm'],
              colorTag: '#3b82f6',
              closeSessionOnExit: true,
              keepaliveInterval: 30,
            });
          }
        }
      }
    }
  }

  return profiles;
}

/**
 * Generates MobaXterm `.mxtsessions` export file content
 */
export function exportToMobaXtermSessions(profiles: ServerProfile[]): string {
  let output = `[Bookmarks]\nSubRep=\nImgNum=41\n`;

  // Group by folder
  const folders = Array.from(new Set(profiles.map(p => p.folder || 'Default')));

  for (const folder of folders) {
    output += `\n[Bookmarks_${folder.replace(/[^a-zA-Z0-9_]/g, '_')}]\n`;
    output += `SubRep=${folder}\nImgNum=41\n`;

    const folderProfiles = profiles.filter(p => (p.folder || 'Default') === folder);
    for (const p of folderProfiles) {
      // MobaXterm SSH format: Name=#109#0%host%port%user%%-1%-1%%%22%%0%0%0%%%-1%0%0%0%%1080%#MobaFont%10%0%0%-1%15%236,236,236%0,0,0%180;180;180%0%0%0%0
      output += `${p.name}=#109#0%${p.host}%${p.port}%${p.username}%%-1%-1%%%22%%0%0%0%%%-1%0%0%0%%1080%#MobaFont%10%0%0%-1%15%236,236,236%0,0,0%180;180;180%0%0%0%0\n`;
    }
  }

  return output;
}

/**
 * Export to NodeSSH JSON backup format
 */
export function exportToNodeSSHJson(data: {
  profiles?: ServerProfile[];
  snippets?: any[];
  tunnels?: any[];
  settings?: any;
}): string {
  return JSON.stringify(
    {
      nodessh_version: '1.0.0',
      exported_at: new Date().toISOString(),
      ...data,
    },
    null,
    2
  );
}
