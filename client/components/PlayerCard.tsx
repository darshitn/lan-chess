import React from 'react';
import type { CapturedPiece, PlayerColor } from '../../shared/types.js';
import { formatClock } from '../utils/chess-helpers.js';
import { CapturedPieces } from './CapturedPieces.js';

interface PlayerCardProps {
  name: string;
  color: PlayerColor;
  isTurn: boolean;
  timeMs: number | null;
  capturedPieces: CapturedPiece[];
  advantage?: number;
  isLocalPlayer: boolean;
  isDisconnected?: boolean;
  avatar?: string;
}


export const PlayerCard: React.FC<PlayerCardProps> = React.memo(({
  name,
  color,
  isTurn,
  timeMs,
  capturedPieces,
  advantage,
  isLocalPlayer,
  isDisconnected,
  avatar,
}) => {
  const isLowTime = timeMs !== null && timeMs <= 15000;
  const isWhite = color === 'w';

  return (
    <div
      className="player-card"
      data-active={isTurn}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="seat-marker" data-color={color} aria-label={isWhite ? 'White pieces' : 'Black pieces'}>
            {isLocalPlayer && avatar ? avatar : isWhite ? '♙' : '♟'}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-white">
                {name}
              </span>
              {isLocalPlayer && (
                <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  You
                </span>
              )}
              {isDisconnected && (
                <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                  Disconnected
                </span>
              )}
            </div>
            <CapturedPieces pieces={capturedPieces} color={isWhite ? 'b' : 'w'} advantage={advantage} />
          </div>
        </div>

        {timeMs !== null && (
          <div
            className="player-clock" data-low={isLowTime}
          >
            {formatClock(timeMs)}
          </div>
        )}
      </div>
    </div>
  );
});

PlayerCard.displayName = 'PlayerCard';
