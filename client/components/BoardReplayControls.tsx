import React from 'react';

export interface BoardReplayControlsProps {
  viewedPly: number;
  moveCount: number;
  isViewingHistory: boolean;
  viewedMoveLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onLive: () => void;
  maxWidth?: number;
  className?: string;
}

export const BoardReplayControls: React.FC<BoardReplayControlsProps> = ({
  viewedPly,
  moveCount,
  isViewingHistory,
  viewedMoveLabel,
  onPrevious,
  onNext,
  onLive,
  maxWidth,
  className = '',
}) => {
  return (
    <div
      className={`mx-auto mt-2 flex w-full items-center justify-between gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs ${className}`}
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
      aria-label="Review moves during the game"
    >
      <div className="min-w-0 flex-1" title={viewedMoveLabel}>
        <p className="truncate font-semibold text-slate-100">{viewedMoveLabel}</p>
        <p className={`${isViewingHistory ? 'text-amber-300' : 'text-emerald-300'}`}>
          {isViewingHistory ? 'Earlier position' : 'Live position'}
        </p>
        {isViewingHistory && <span className="sr-only">Live game and clocks continue</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={viewedPly === 0}
          aria-label="Previous move"
          title="Previous move"
          className="action-button action-secondary px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ←
        </button>
        <span
          className="min-w-8 text-center font-mono text-xs text-slate-300"
          aria-label={`Move ${viewedPly} of ${moveCount}`}
        >
          {viewedPly}/{moveCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!isViewingHistory}
          aria-label="Next move"
          title="Next move"
          className="action-button action-secondary px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          →
        </button>
        <button
          type="button"
          onClick={onLive}
          disabled={!isViewingHistory}
          className="action-button action-secondary px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          Live
        </button>
      </div>
    </div>
  );
};
