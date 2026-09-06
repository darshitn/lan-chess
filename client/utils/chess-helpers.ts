import { Chess } from 'chess.js';
import type { CapturedPiece, PlayerColor, TimeControl } from '../../shared/types.js';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const PIECE_VALUES: Record<CapturedPiece, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const STARTING_PIECES: Record<CapturedPiece, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

/** Time-control presets grouped by speed, matching the lobby picker. */
export const TIME_CONTROL_GROUPS: Array<{
  category: string;
  icon: string;
  controls: TimeControl[];
}> = [
  { category: 'Bullet', icon: '🔥', controls: ['1+0', '1+1', '2+1'] },
  { category: 'Blitz', icon: '⚡', controls: ['3+0', '3+2', '5+0'] },
  { category: 'Rapid', icon: '⏱️', controls: ['10+0', '10+5', '15+10'] },
  { category: 'Casual', icon: '∞', controls: ['unlimited'] },
];

export function isKnownTimeControl(value: unknown): value is TimeControl {
  return (
    typeof value === 'string' &&
    TIME_CONTROL_GROUPS.some((g) => (g.controls as string[]).includes(value))
  );
}

/** Human label for a time control: "3 min", "3 + 2", "No Clock". */
export function formatTimeControl(timeControl: TimeControl): string {
  if (timeControl === 'unlimited') return 'No Clock';
  const [base, increment] = timeControl.split('+');
  return Number(increment) > 0 ? `${base} + ${increment}` : `${base} min`;
}

/**
 * Standard chess square parity:
 * - Square a1 is DARK
 * - Square h1 is LIGHT ("white on right")
 * - Square a8 is LIGHT
 * - Square h8 is DARK
 */
export function isLightSquare(file: string, rank: string): boolean {
  return (FILES.indexOf(file as typeof FILES[number]) + Number(rank)) % 2 === 0;
}

export function formatClock(ms: number | null): string {
  if (ms === null) return '∞';
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getCapturedPiecesAndScore(chess: Chess) {
  const currentCount: Record<PlayerColor, Record<CapturedPiece, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        currentCount[sq.color][sq.type as CapturedPiece]++;
      }
    }
  }

  const capturedWhite: CapturedPiece[] = [];
  const capturedBlack: CapturedPiece[] = [];
  let whiteMaterial = 0;
  let blackMaterial = 0;

  (['q', 'r', 'b', 'n', 'p'] as CapturedPiece[]).forEach((type) => {
    const whiteMissing = Math.max(0, STARTING_PIECES[type] - currentCount.w[type]);
    for (let i = 0; i < whiteMissing; i++) capturedWhite.push(type);
    whiteMaterial += currentCount.w[type] * PIECE_VALUES[type];

    const blackMissing = Math.max(0, STARTING_PIECES[type] - currentCount.b[type]);
    for (let i = 0; i < blackMissing; i++) capturedBlack.push(type);
    blackMaterial += currentCount.b[type] * PIECE_VALUES[type];
  });

  const whiteAdvantage = Math.max(0, whiteMaterial - blackMaterial);
  const blackAdvantage = Math.max(0, blackMaterial - whiteMaterial);

  return { capturedWhite, capturedBlack, whiteAdvantage, blackAdvantage };
}
