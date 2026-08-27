import { Profile, ProfileCreateDTO } from '../types';

/**
 * Parses MobaXterm .ini session exports into NodeSSH profiles
 * MobaXterm uses sections like [Bookmarks] or [Bookmarks_1] with session entries:
 * SessionName=#109#0%host%port%username%...
 */
export function parseMobaXtermIni(iniContent: string): ProfileCreateDTO[] {
  const profiles: ProfileCreateDTO[] = [];
  const lines = iniContent.split(/\r?\n/);

  let currentFolder = '';

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      const sectionName = line.slice(1, -1).trim();
      if (!sectionName.startsWith('Bookmarks')) {
        currentFolder = sectionName;
      }
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();

    if (key === 'SubRep') {
      currentFolder = value.replace(/\\/g, '/');
      continue;
    }

    // Check if value is a MobaXterm SSH bookmark descriptor
    // #109#0% indicates SSH session (or #109#1%)
    if (value.startsWith('#109#') || value.includes('%')) {
      const parts = value.split('%');
      if (parts.length >= 4) {
        const host = parts[1]?.trim() || '';
        const port = parseInt(parts[2]?.trim() || '22', 10) || 22;
        const username = parts[3]?.trim() || '';

        if (host) {
          profiles.push({
            name: key,
            host,
            port,
            username: username || 'root',
            auth_type: 'password',
            group_name: currentFolder || undefined,
            keepalive_interval: 15,
            close_on_exit: true,
          });
        }
      }
    }
  }

  return profiles;
}

/**
 * Exports NodeSSH profiles into MobaXterm compatible .ini format
 */
export function exportToMobaXtermIni(profiles: Profile[]): string {
  let output = '[Bookmarks]\n';
  output += 'SubRep=\n';
  output += 'ImgNum=41\n\n';

  // Group profiles by folder
  const groups: Record<string, Profile[]> = {};
  for (const p of profiles) {
    const group = p.group_name || '';
    if (!groups[group]) groups[group] = [];
    groups[group].push(p);
  }

  let bookmarkIndex = 1;
  for (const [groupName, groupProfiles] of Object.entries(groups)) {
    if (groupName) {
      output += `[Bookmarks_${bookmarkIndex}]\n`;
      output += `SubRep=${groupName}\n`;
      output += `ImgNum=41\n`;
      bookmarkIndex++;
    }

    for (const p of groupProfiles) {
      // MobaXterm SSH entry format:
      // Name=#109#0%host%port%username%%-1%-1%%%22%%0%0%0%%-1%-1
      const entry = `#109#0%${p.host}%${p.port}%${p.username}%%-1%-1%%%22%%0%0%0%%-1%-1`;
      output += `${p.name}=${entry}\n`;
    }
    output += '\n';
  }

  return output;
}
