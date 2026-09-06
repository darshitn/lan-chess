import React from 'react';
import type { CapturedPiece, PlayerColor } from '../../shared/types.js';

const PIECE_GLYPHS: Record<PlayerColor, Record<CapturedPiece, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

interface CapturedPiecesProps {
  pieces: CapturedPiece[];
  color: PlayerColor;
  advantage?: number;
}

export const CapturedPieces: React.FC<CapturedPiecesProps> = React.memo(({ pieces, color, advantage }) => {
  if (pieces.length === 0 && !advantage) {
    return <div className="captured-pieces min-h-[1.5rem]" />;
  }

  return (
    <div className="captured-pieces min-h-[1.5rem]" aria-label={`Captured ${color === 'w' ? 'white' : 'black'} pieces`}>
      {pieces.map((piece, index) => (
        <span key={`${piece}-${index}`} className="text-xl leading-none">
          {PIECE_GLYPHS[color][piece]}
        </span>
      ))}
      {advantage !== undefined && advantage > 0 && (
        <span className="ml-1 text-xs font-bold text-amber-400">+{advantage}</span>
      )}
    </div>
  );
});

CapturedPieces.displayName = 'CapturedPieces';
