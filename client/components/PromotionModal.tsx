import React from 'react';
import type { PieceSetId } from '../types/preferences.js';
import { useModalBehavior } from '../utils/modal-behavior.js';
import type { PlayerColor, PromotionPiece } from '../../shared/types.js';
import { ChessPiece } from './chess/ChessPiece.js';

interface PromotionModalProps {
  color: PlayerColor;
  pieceSet?: PieceSetId;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

const PROMOTION_CHOICES: Array<{ piece: PromotionPiece; label: string }> = [
  { piece: 'q', label: 'Queen' },
  { piece: 'r', label: 'Rook' },
  { piece: 'b', label: 'Bishop' },
  { piece: 'n', label: 'Knight' },
];

export const PromotionModal: React.FC<PromotionModalProps> = ({ color, pieceSet, onSelect, onCancel }) => {
  const modalRef = useModalBehavior(onCancel);

  return (
    <div
      className="promotion-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pawn Promotion"
      onClick={onCancel}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="promotion-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Promote your pawn</h2>
        <p className="mt-1 text-sm text-slate-300">Choose a piece to replace your promoting pawn:</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {PROMOTION_CHOICES.map(({ piece, label }) => (
            <button
              key={piece}
              type="button"
              className="promotion-choice flex flex-col items-center justify-center p-2 text-center transition-all hover:scale-105"
              aria-label={label}
              onClick={() => onSelect(piece)}
            >
              <div className="h-12 w-12 flex items-center justify-center">
                <ChessPiece type={piece} color={color} pieceSet={pieceSet} className="h-full w-full" />
              </div>
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
