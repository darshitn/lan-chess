import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  formatClock,
  getCapturedPiecesAndScore,
  isLightSquare,
} from './chess-helpers.js';

describe('chess-helpers', () => {
  describe('isLightSquare (Parity)', () => {
    it('correctly identifies standard chess square colors', () => {
      // Bottom rank
      expect(isLightSquare('a', '1')).toBe(false); // a1 is dark
      expect(isLightSquare('b', '1')).toBe(true);  // b1 is light
      expect(isLightSquare('c', '1')).toBe(false); // c1 is dark
      expect(isLightSquare('d', '1')).toBe(true);  // d1 is light
      expect(isLightSquare('e', '1')).toBe(false); // e1 is dark
      expect(isLightSquare('f', '1')).toBe(true);  // f1 is light
      expect(isLightSquare('g', '1')).toBe(false); // g1 is dark
      expect(isLightSquare('h', '1')).toBe(true);  // h1 is light ("white on right")

      // Top rank
      expect(isLightSquare('a', '8')).toBe(true);  // a8 is light
      expect(isLightSquare('h', '8')).toBe(false); // h8 is dark
    });
  });

  describe('formatClock', () => {
    it('formats milliseconds into MM:SS', () => {
      expect(formatClock(null)).toBe('∞');
      expect(formatClock(180000)).toBe('3:00');
      expect(formatClock(65000)).toBe('1:05');
      expect(formatClock(9000)).toBe('0:09');
      expect(formatClock(0)).toBe('0:00');
    });
  });

  describe('getCapturedPiecesAndScore', () => {
    it('returns empty captures at initial starting board', () => {
      const chess = new Chess();
      const result = getCapturedPiecesAndScore(chess);

      expect(result.capturedWhite).toHaveLength(0);
      expect(result.capturedBlack).toHaveLength(0);
      expect(result.whiteAdvantage).toBe(0);
      expect(result.blackAdvantage).toBe(0);
    });

    it('calculates captured piece and material advantage accurately after capture', () => {
      const chess = new Chess();
      // 1. e4 d5 2. exd5 (White pawn captures Black pawn)
      chess.move('e4');
      chess.move('d5');
      chess.move('exd5');

      const result = getCapturedPiecesAndScore(chess);
      // Black lost a pawn, so capturedBlack has 'p'
      expect(result.capturedBlack).toEqual(['p']);
      expect(result.capturedWhite).toHaveLength(0);
      expect(result.whiteAdvantage).toBe(1);
      expect(result.blackAdvantage).toBe(0);
    });
  });
});
