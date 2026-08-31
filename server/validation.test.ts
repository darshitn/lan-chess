import { describe, expect, it } from 'vitest';
import { isChessSquare, normalizePromotion, normalizeRoomCode, sanitizeChatMessage, sanitizePlayerName, validateSessionId } from './validation.js';

describe('security validation helpers', () => {
  it('sanitizes player names to safe length and removes control characters', () => {
    expect(sanitizePlayerName('  Alice\u0007  ')).toBe('Alice');
    expect(sanitizePlayerName('x'.repeat(300))).toHaveLength(24);
    expect(sanitizePlayerName('   ')).toBe('Player');
  });

  it('normalizes room codes and rejects invalid values', () => {
    expect(normalizeRoomCode(' ab-12 ')).toBe('AB12');
    expect(normalizeRoomCode('abcde!')).toBe('ABCDE');
    expect(normalizeRoomCode('ab')).toBeNull();
    expect(normalizeRoomCode('')).toBeNull();
  });

  it('sanitizes chat messages and validates session identifiers', () => {
    expect(sanitizeChatMessage('  hello\nworld\u0001  ')).toBe('hello world');
    expect(sanitizeChatMessage('x'.repeat(500))).toHaveLength(180);
    expect(validateSessionId('session-abc123')).toBe('session-abc123');
    expect(validateSessionId('bad id')).toBeNull();
  });

  it('validates chess square and promotion payloads', () => {
    expect(isChessSquare('e4')).toBe(true);
    expect(isChessSquare('z9')).toBe(false);
    expect(normalizePromotion('q')).toBe('q');
    expect(normalizePromotion('x')).toBeUndefined();
  });
});
