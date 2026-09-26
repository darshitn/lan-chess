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
