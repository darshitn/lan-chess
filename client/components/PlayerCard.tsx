import React from 'react';
import type { CapturedPiece, PlayerColor } from '../../shared/types.js';
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
}

function formatClock(ms: number | null): string {
  if (ms === null) return '∞';
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
}) => {
  const isLowTime = timeMs !== null && timeMs <= 15000;
  const isWhite = color === 'w';

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-200 ${
        isTurn
          ? 'border-amber-400/80 bg-slate-800/90 shadow-md shadow-amber-500/10'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full border ${
              isWhite
                ? 'border-slate-300 bg-white'
                : 'border-slate-700 bg-slate-950'
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
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
            className={`rounded-lg px-2.5 py-1 font-mono text-base font-bold tabular-nums transition-colors ${
              isLowTime
                ? 'bg-rose-950/80 text-rose-300 animate-pulse border border-rose-500/40'
                : isTurn
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {formatClock(timeMs)}
          </div>
        )}
      </div>
    </div>
  );
});

PlayerCard.displayName = 'PlayerCard';
