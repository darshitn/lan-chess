import React, { useEffect } from 'react';
import type { PlayerColor, PromotionPiece } from '../../shared/types.js';

interface PromotionModalProps {
  color: PlayerColor;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

const PROMOTION_CHOICES: Array<{ piece: PromotionPiece; label: string; glyph: Record<PlayerColor, string> }> = [
  { piece: 'q', label: 'Queen', glyph: { w: '♕', b: '♛' } },
  { piece: 'r', label: 'Rook', glyph: { w: '♖', b: '♜' } },
  { piece: 'b', label: 'Bishop', glyph: { w: '♗', b: '♝' } },
  { piece: 'n', label: 'Knight', glyph: { w: '♘', b: '♞' } },
];

export const PromotionModal: React.FC<PromotionModalProps> = ({ color, onSelect, onCancel }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="promotion-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pawn Promotion"
      onClick={onCancel}
    >
      <div
        className="promotion-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Pawn Promotion</p>
        <h2>Promote your pawn</h2>
        <p className="mt-1 text-sm text-slate-300">Choose a piece to replace your promoting pawn:</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {PROMOTION_CHOICES.map(({ piece, label, glyph }) => (
            <button
              key={piece}
              type="button"
              className="promotion-choice flex flex-col items-center justify-center p-2 text-center"
              aria-label={label}
              onClick={() => onSelect(piece)}
            >
              <span>{glyph[color]}</span>
              <span className="mt-1 text-xs font-semibold text-slate-300">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="action-button action-secondary text-sm"
            onClick={onCancel}
          >
            Cancel Move
          </button>
        </div>
      </div>
    </div>
  );
};
