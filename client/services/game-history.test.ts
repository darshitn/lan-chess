import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteSavedGame,
  getSavedGames,
  saveCompletedGame,
  toggleFavoriteGame,
  type SavedGame,
} from './game-history.js';

function installFakeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  return store;
}

function validGame(overrides: Partial<SavedGame> = {}): SavedGame {
  return {
    id: 'game-1',
    roomCode: 'ABCD',
    date: 1000,
    whiteName: 'Alice',
    blackName: 'Bob',
    winner: 'w',
    reason: 'Checkmate',
    timeControl: '3+0',
    pgn: '1. e4 e5',
    moves: [{ from: 'e2', to: 'e4', san: 'e4', color: 'w' }],
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    opening: null,
    isFavorite: false,
    ...overrides,
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('game history persistence', () => {
  it('round-trips a saved game', () => {
    installFakeStorage();
    saveCompletedGame(validGame());
    const games = getSavedGames();
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('game-1');
    expect(games[0].whiteName).toBe('Alice');
  });

  it('returns an empty list for corrupted JSON', () => {
    installFakeStorage({ 'lan-chess-game-history-v2': '{not json' });
    expect(getSavedGames()).toEqual([]);
  });

  it('returns an empty list when storage holds a non-array', () => {
    installFakeStorage({ 'lan-chess-game-history-v2': JSON.stringify({ id: 'x' }) });
    expect(getSavedGames()).toEqual([]);
  });

  it('drops malformed records instead of crashing consumers', () => {
    installFakeStorage({
      'lan-chess-game-history-v2': JSON.stringify([
        'garbage',
        null,
        { id: 'missing-fields' },
        validGame({ id: 'missing-moves', moves: undefined as unknown as SavedGame['moves'] }),
        validGame({ id: 'missing-names', whiteName: undefined as unknown as string }),
        validGame({ id: 'good' }),
      ]),
    });
    const games = getSavedGames();
    expect(games.map((g) => g.id)).toEqual(['good']);
  });

  it('caps history at 50 games, newest first', () => {
    installFakeStorage();
    for (let i = 0; i < 55; i++) {
      saveCompletedGame(validGame({ id: `game-${i}`, date: i }));
    }
    const games = getSavedGames();
    expect(games).toHaveLength(50);
    expect(games[0].id).toBe('game-54');
  });

  it('deletes and toggles favorites by id', () => {
    installFakeStorage();
    saveCompletedGame(validGame({ id: 'a' }));
    saveCompletedGame(validGame({ id: 'b' }));

    toggleFavoriteGame('a');
    expect(getSavedGames().find((g) => g.id === 'a')?.isFavorite).toBe(true);

    deleteSavedGame('b');
    expect(getSavedGames().map((g) => g.id)).toEqual(['a']);
  });
});
