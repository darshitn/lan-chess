import React from 'react';
import type { GameResult, PlayerColor } from '../../shared/types.js';
import { useModalBehavior } from '../utils/modal-behavior.js';

interface GameOverModalProps {
  winner: GameResult | null;
  reason: string | null;
  userColor: PlayerColor | null;
  isSpectator: boolean;
  rematchRequestedByMe: boolean;
  rematchRequestedByOpponent: boolean;
  onRequestRematch: () => void;
  onRespondRematch: (accept: boolean) => void;
  onLeaveRoom: () => void;
  onReviewGame: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
  reason,
  userColor,
  isSpectator,
  rematchRequestedByMe,
  rematchRequestedByOpponent,
  onRequestRematch,
  onRespondRematch,
  onLeaveRoom,
  onReviewGame,
}) => {
  let outcomeTitle = 'Game Finished';
  let outcomeSubtitle = reason ?? '';

  if (winner === 'draw') {
    outcomeTitle = 'Draw';
  } else if (winner) {
    const winnerName = winner === 'w' ? 'White' : 'Black';
    if (!isSpectator && userColor) {
      outcomeTitle = winner === userColor ? 'Victory!' : 'Defeat';
    } else {
      outcomeTitle = `${winnerName} Won!`;
    }
  }

  // The game-over dialog appears after every game: move focus into it so
  // keyboard users are not left triggering board actions invisibly.
  const modalRef = useModalBehavior(null, false);

  return (
    <div
      className="promotion-backdrop z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Game Over"
    >
      <div ref={modalRef} tabIndex={-1} className="promotion-dialog text-center focus:outline-none">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Game Over</p>
        <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{outcomeTitle}</h2>
        {outcomeSubtitle && (
          <p className="mt-2 text-sm text-slate-300">{outcomeSubtitle}</p>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-700/60 pt-4">
          <button
            type="button"
            onClick={onReviewGame}
            className="action-button action-primary w-full text-sm font-bold flex items-center justify-center gap-2"
          >
            <span>🔍</span>
            <span>Review Game & Analysis</span>
          </button>

          {!isSpectator && (
            <div className="mt-2">
              {rematchRequestedByOpponent ? (
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    Opponent wants a rematch!
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRespondRematch(true)}
                      className="action-button action-primary flex-1 text-sm"
                    >
                      Accept Rematch
                    </button>
                    <button
                      type="button"
                      onClick={() => onRespondRematch(false)}
                      className="action-button action-secondary flex-1 text-sm"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ) : rematchRequestedByMe ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                  Rematch requested. Waiting for opponent to respond...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onRequestRematch}
                  className="action-button action-secondary w-full text-sm font-semibold"
                >
                  Request Rematch
                </button>
              )}
            </div>
          )}

          <div className="mt-2">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="action-button action-secondary w-full text-xs text-slate-400 hover:text-white"
            >
              Leave Room & Return to Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
