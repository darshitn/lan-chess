import { Chess } from 'chess.js';
import { expect, it } from 'vitest';
import { computeReplayState, getPositionAtPly } from './live-game-replay.js';
import type { GameMove, PromotionPiece } from '../../shared/types.js';

it.each([
  { sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'O-O'], fen: undefined },
  { sans: ['e4', 'a6', 'e5', 'd5', 'exd6'], fen: undefined },
  { sans: ['a8=Q+'], fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' },
])('reconstructs special moves without mutating the live board: $sans', ({ sans, fen }) => {
  const live = new Chess(fen);
  const positions = [live.fen()];
  const moves: GameMove[] = sans.map(san => { const m = live.move(san); positions.push(live.fen()); return { from: m.from, to: m.to, color: m.color, san: m.san, promotion: m.promotion as PromotionPiece | undefined }; });
  const finalFen = live.fen();
  for (let ply = 0; ply <= moves.length; ply++) expect(getPositionAtPly(moves, ply, fen)?.fen()).toBe(positions[ply]);
  expect(computeReplayState(moves, live, 0, fen).isViewingHistory).toBe(true);
  expect(live.fen()).toBe(finalFen);
  expect(getPositionAtPly(moves, -1)).toBeNull();
  expect(getPositionAtPly(moves, moves.length + 1)).toBeNull();
});
