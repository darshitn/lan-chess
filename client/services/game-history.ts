import type { GameMove, GameResult, PlayerColor, TimeControl } from '../../shared/types.js';
import type { OpeningInfo } from '../utils/openings.js';

export interface SavedGame {
  id: string;
  roomCode: string;
  date: number;
  whiteName: string;
  blackName: string;
  winner: GameResult | null;
  reason: string | null;
  timeControl: TimeControl;
  pgn: string;
  moves: GameMove[];
  fen: string;
  opening?: OpeningInfo | null;
  isFavorite?: boolean;
}

const STORAGE_KEY = 'lan-chess-game-history-v2';

function isPlayerColor(value: unknown): value is PlayerColor {
  return value === 'w' || value === 'b';
}

function isValidGameMove(value: unknown): value is GameMove {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.from === 'string' &&
    typeof m.to === 'string' &&
    typeof m.san === 'string' &&
    isPlayerColor(m.color)
  );
}

/**
 * Structural validation for records loaded from localStorage. One corrupted or
 * outdated record must never crash a whole view (names/moves are dereferenced
 * unconditionally downstream), so invalid records are dropped at load time.
 */
function isValidSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    g.id.length > 0 &&
    typeof g.roomCode === 'string' &&
    typeof g.date === 'number' &&
    Number.isFinite(g.date) &&
    typeof g.whiteName === 'string' &&
    typeof g.blackName === 'string' &&
    (g.winner === 'w' || g.winner === 'b' || g.winner === 'draw' || g.winner === null) &&
    (g.reason === null || g.reason === undefined || typeof g.reason === 'string') &&
    typeof g.timeControl === 'string' &&
    typeof g.pgn === 'string' &&
    typeof g.fen === 'string' &&
    Array.isArray(g.moves) &&
    g.moves.every(isValidGameMove) &&
    (g.opening === undefined || g.opening === null || typeof g.opening === 'object')
  );
}

function writeGames(games: SavedGame[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('Game history could not be saved: local storage is full.');
    } else {
      console.warn('Game history could not be saved.', error);
    }
    return false;
  }
}

export function getSavedGames(): SavedGame[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedGame);
  } catch {
    return [];
  }
}

export function saveCompletedGame(game: SavedGame): void {
  if (typeof window === 'undefined') return;
  // Prepend new game, keep max 50 recent games
  const existing = getSavedGames();
  writeGames([game, ...existing.filter((g) => g.id !== game.id)].slice(0, 50));
}

export function deleteSavedGame(id: string): void {
  if (typeof window === 'undefined') return;
  writeGames(getSavedGames().filter((g) => g.id !== id));
}

export function toggleFavoriteGame(id: string): void {
  if (typeof window === 'undefined') return;
  writeGames(
    getSavedGames().map((g) => (g.id === id ? { ...g, isFavorite: !g.isFavorite } : g))
  );
}
