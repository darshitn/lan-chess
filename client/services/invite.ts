/**
 * LAN Chess — Invitation Text Formatting.
 */

export function buildFullInviteText(roomCode: string, hostUrl: string | null): string {
  const lines = ['Join my LAN Chess game'];
  if (hostUrl) {
    lines.push(`Open: ${hostUrl}`);
  }
  lines.push(`Room code: ${roomCode}`);
  lines.push('Make sure we are connected to the same Wi-Fi.');
  return lines.join('\n');
}

export function buildLinkInviteText(hostUrl: string | null): string {
  return hostUrl ?? '';
}

/** The QR link opens the host's Join form; it never joins a room automatically. */
export function buildRoomInviteUrl(roomCode: string, hostUrl: string | null): string | null {
  if (!hostUrl || !/^[A-Z0-9]{3,5}$/i.test(roomCode)) return null;
  try {
    const url = new URL(hostUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.searchParams.set('room', roomCode.toUpperCase());
    return url.toString();
  } catch {
    return null;
  }
}

export function getRoomCodeFromUrl(search: string): string | null {
  const code = new URLSearchParams(search).get('room')?.toUpperCase() ?? '';
  return /^[A-Z0-9]{3,5}$/.test(code) ? code : null;
}
