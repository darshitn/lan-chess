import type { SavedGame } from './game-history.js';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // percentage
  avgGameLength: number; // plies or moves
  favoriteOpening: string;
  mostPlayedColor: 'White' | 'Black' | 'Equal';
  fastestWin: number | null; // in moves
  longestGame: number; // in moves
  totalCaptures: number;
}

export function computePlayerStats(games: SavedGame[], playerName: string): PlayerStats {
  const normName = typeof playerName === 'string' ? playerName.trim().toLowerCase() : '';
  // An empty name would otherwise match games with empty stored names and
  // produce phantom statistics.
  const zeroed: PlayerStats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    avgGameLength: 0,
    favoriteOpening: 'None yet',
    mostPlayedColor: 'Equal',
    fastestWin: null,
    longestGame: 0,
    totalCaptures: 0,
  };
  if (!normName) return zeroed;

  let gamesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalMoves = 0;
  let whiteCount = 0;
  let blackCount = 0;
  let fastestWin: number | null = null;
  let longestGame = 0;
  let totalCaptures = 0;

  const openingCounts = new Map<string, number>();

  for (const game of games) {
    // Records are validated at load time; stay defensive anyway so a single
    // malformed entry can never crash the statistics view.
    const whiteName = typeof game?.whiteName === 'string' ? game.whiteName : '';
    const blackName = typeof game?.blackName === 'string' ? game.blackName : '';
    const moves = Array.isArray(game?.moves) ? game.moves : [];

    const isWhite = whiteName.trim().toLowerCase() === normName;
    const isBlack = blackName.trim().toLowerCase() === normName;

    // If player is neither, skip or treat as general game
    if (!isWhite && !isBlack) continue;

    gamesPlayed++;
    if (isWhite) whiteCount++;
    if (isBlack) blackCount++;

    const moveCount = Math.ceil(moves.length / 2);
    totalMoves += moveCount;

    if (moveCount > longestGame) {
      longestGame = moveCount;
    }

    // Count captures
    for (const m of moves) {
      if (m?.captured) totalCaptures++;
    }

    // Result calculation (a null winner is an unfinished/unknown game)
    if (game.winner === 'draw') {
      draws++;
    } else if (game.winner === null) {
      // neither win nor loss
    } else if ((game.winner === 'w' && isWhite) || (game.winner === 'b' && isBlack)) {
      wins++;
      if (fastestWin === null || moveCount < fastestWin) {
        fastestWin = moveCount;
      }
    } else {
      losses++;
    }

    // Opening frequency
    if (game.opening?.name) {
      const current = openingCounts.get(game.opening.name) ?? 0;
      openingCounts.set(game.opening.name, current + 1);
    }
  }

  // Favorite opening (deterministic tie-break: most played, then alphabetical)
  let favoriteOpening = 'None yet';
  let maxOpeningCount = 0;
  for (const [name, count] of openingCounts.entries()) {
    if (
      count > maxOpeningCount ||
      (count === maxOpeningCount && count > 0 && name.localeCompare(favoriteOpening) < 0)
    ) {
      maxOpeningCount = count;
      favoriteOpening = name;
    }
  }

  // Most played color
  let mostPlayedColor: 'White' | 'Black' | 'Equal' = 'Equal';
  if (whiteCount > blackCount) mostPlayedColor = 'White';
  else if (blackCount > whiteCount) mostPlayedColor = 'Black';

  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const avgGameLength = gamesPlayed > 0 ? Math.round(totalMoves / gamesPlayed) : 0;

  return {
    gamesPlayed,
    wins,
    losses,
    draws,
    winRate,
    avgGameLength,
    favoriteOpening,
    mostPlayedColor,
    fastestWin,
    longestGame,
    totalCaptures,
  };
}
