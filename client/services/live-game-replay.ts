import { Chess } from 'chess.js';
import type { GameMove } from '../../shared/types.js';

export interface ReplayState {
  viewedPly: number;
  isViewingHistory: boolean;
  displayedChess: Chess;
  displayedLastMove: GameMove | null;
  viewedMoveLabel: string;
}

/** Rebuild a read-only board position from the authoritative move list. */
export function getPositionAtPly(moves: GameMove[], ply: number, initialFen?: string): Chess | null {
  if (!Number.isInteger(ply) || ply < 0 || ply > moves.length) return null;

  let chess: Chess;
  try {
    chess = initialFen ? new Chess(initialFen) : new Chess();
  } catch {
    chess = new Chess();
  }

  try {
    for (let i = 0; i < ply; i += 1) {
      const move = moves[i];
      if (!move) return null;

      try {
        chess.move({ from: move.from, to: move.to, promotion: move.promotion });
      } catch {
        // Fall back to SAN representation if standard coordinate move fails
        if (move.san) {
          chess.move(move.san);
        } else {
          return null;
        }
      }
    }
    return chess;
  } catch {
    // A bad/incomplete history must never crash the live match renderer.
    return null;
  }
}

/** Format a human-readable label for the currently viewed ply. */
export function getReplayMoveLabel(viewedPly: number, moves: GameMove[]): string {
  if (viewedPly <= 0) return 'Start position';
  const lastMove = viewedPly <= moves.length ? moves[viewedPly - 1] : null;
  const moveNumber = Math.ceil(viewedPly / 2);
  const notation = viewedPly % 2 === 1 ? '.' : '...';
  const san = lastMove?.san ?? '';
  return `${moveNumber}${notation} ${san}`.trim();
}

/** Compute the derived replay state from moves, live chess instance, and selected ply. */
export function computeReplayState(
  moves: GameMove[],
  liveChess: Chess,
  replayPly: number | null,
  initialFen?: string
): ReplayState {
  const moveCount = moves.length;
  const requestedPly = replayPly === null ? moveCount : Math.max(0, Math.min(replayPly, moveCount));
  const replayPosition =
    replayPly !== null ? getPositionAtPly(moves, requestedPly, initialFen) : null;
  const isViewingHistory =
    replayPly !== null && requestedPly < moveCount && replayPosition !== null;
  const viewedPly = isViewingHistory ? requestedPly : moveCount;
  const displayedChess = isViewingHistory && replayPosition ? replayPosition : liveChess;
  const displayedLastMove = viewedPly > 0 && viewedPly <= moves.length ? moves[viewedPly - 1] : null;
  const viewedMoveLabel = getReplayMoveLabel(viewedPly, moves);

  return {
    viewedPly,
    isViewingHistory,
    displayedChess,
    displayedLastMove,
    viewedMoveLabel,
  };
}
