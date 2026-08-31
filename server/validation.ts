export const MAX_PLAYER_NAME_LENGTH = 24;
export const MAX_ROOM_CODE_LENGTH = 5;
export const MAX_CHAT_MESSAGE_LENGTH = 180;

export function sanitizePlayerName(value: unknown): string {
  if (typeof value !== 'string') return 'Player';
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
  return cleaned || 'Player';
}

export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_ROOM_CODE_LENGTH);
  if (!/^[A-Z0-9]{3,5}$/.test(cleaned)) return null;
  return cleaned;
}

export function sanitizeChatMessage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

export function validateSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(cleaned)) return null;
  return cleaned;
}

export function isChessSquare(value: unknown): value is string {
  return typeof value === 'string' && /^[a-h][1-8]$/i.test(value);
}

export function normalizePromotion(value: unknown): 'q' | 'r' | 'b' | 'n' | undefined {
  if (value === 'q' || value === 'r' || value === 'b' || value === 'n') return value;
  return undefined;
}
