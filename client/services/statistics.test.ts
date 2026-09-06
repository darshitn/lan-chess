import { describe, expect, it } from 'vitest';
import { computePlayerStats } from './statistics.js';
import type { SavedGame } from './game-history.js';

describe('statistics service', () => {
  it('computes stats for empty game list', () => {
    const stats = computePlayerStats([], 'Player');
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.favoriteOpening).toBe('None yet');
  });

  it('computes accurate wins, win rate, and favorite opening', () => {
    const mockGames: SavedGame[] = [
      {
        id: 'g1',
        roomCode: 'ABCD',
        date: 1000,
        whiteName: 'Grandmaster',
        blackName: 'Alex',
        winner: 'w',
        reason: 'Checkmate',
        timeControl: '3+0',
        pgn: '',
        moves: [
          { from: 'e2', to: 'e4', san: 'e4', color: 'w' },
          { from: 'e7', to: 'e5', san: 'e5', color: 'b' },
          { from: 'g1', to: 'f3', san: 'Nf3', color: 'w' },
          { from: 'b8', to: 'c6', san: 'Nc6', color: 'b' },
          { from: 'f1', to: 'b5', san: 'Bb5', color: 'w' },
        ],
        fen: '',
        opening: { eco: 'C60', name: 'Ruy Lopez' },
      },
      {
        id: 'g2',
        roomCode: 'EFGH',
        date: 2000,
        whiteName: 'Alex',
        blackName: 'Grandmaster',
        winner: 'draw',
        reason: 'Draw agreed',
        timeControl: '5+0',
        pgn: '',
        moves: [
          { from: 'e2', to: 'e4', san: 'e4', color: 'w' },
          { from: 'e7', to: 'e5', san: 'e5', color: 'b' },
        ],
        fen: '',
        opening: { eco: 'C20', name: "King's Pawn Game" },
      },
      {
        id: 'g3',
        roomCode: 'IJKL',
        date: 3000,
        whiteName: 'Grandmaster',
        blackName: 'Bob',
        winner: 'w',
        reason: 'Checkmate',
        timeControl: '3+0',
        pgn: '',
        moves: [
          { from: 'e2', to: 'e4', san: 'e4', color: 'w' },
          { from: 'e7', to: 'e5', san: 'e5', color: 'b' },
          { from: 'g1', to: 'f3', san: 'Nf3', color: 'w' },
          { from: 'b8', to: 'c6', san: 'Nc6', color: 'b' },
          { from: 'f1', to: 'b5', san: 'Bb5', color: 'w' },
        ],
        fen: '',
        opening: { eco: 'C60', name: 'Ruy Lopez' },
      },
    ];

    const stats = computePlayerStats(mockGames, 'Grandmaster');
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.draws).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(67); // 2/3 = 67%
    expect(stats.favoriteOpening).toBe('Ruy Lopez');
    expect(stats.mostPlayedColor).toBe('White');
  });

  it('never crashes on malformed records and skips them safely', () => {
    const malformed = {
      id: 'bad',
      // whiteName/blackName/moves missing entirely (corrupted localStorage)
    } as unknown as SavedGame;
    const stats = computePlayerStats([malformed], 'Alex');
    expect(stats.gamesPlayed).toBe(0);
  });

  it('does not count a null winner as a loss', () => {
    const games: SavedGame[] = [
      {
        id: 'g1',
        roomCode: 'ABCD',
        date: 1000,
        whiteName: 'Alex',
        blackName: 'Bob',
        winner: null,
        reason: null,
        timeControl: '3+0',
        pgn: '',
        moves: [{ from: 'e2', to: 'e4', san: 'e4', color: 'w' }],
        fen: '',
        opening: null,
      },
    ];
    const stats = computePlayerStats(games, 'Alex');
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.draws).toBe(0);
  });

  it('returns zeroed stats for an empty player name', () => {
    const stats = computePlayerStats(
      [
        {
          id: 'g1',
          roomCode: 'ABCD',
          date: 1000,
          whiteName: '',
          blackName: '',
          winner: 'w',
          reason: null,
          timeControl: '3+0',
          pgn: '',
          moves: [],
          fen: '',
          opening: null,
        },
      ],
      ''
    );
    expect(stats.gamesPlayed).toBe(0);
  });
});
