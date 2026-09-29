import React from 'react';
import {
  DEFAULT_MIN_BOARD_SIZE,
  BOARD_SIZE_STEP,
} from '../services/board-sizing.js';
import type { BoardSizeMode } from '../services/board-display.js';

export interface BoardControlsProps {
  sizeMode: BoardSizeMode;
  currentSize: number;
  fitSize: number;
  maxAllowedWidth: number;
  focusBoard: boolean;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  fullscreenError?: string | null;
  onClearFullscreenError?: () => void;
  onSetSizeMode: (mode: BoardSizeMode) => void;
  onCustomSizeChange: (size: number) => void;
  onStepSize: (delta: number) => void;
  onResetToFit: () => void;
  onToggleFocusBoard: () => void;
  onToggleFullscreen: () => void;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  sizeMode,
  currentSize,
  maxAllowedWidth,
  focusBoard,
  isFullscreen,
  isFullscreenSupported,
  fullscreenError,
  onClearFullscreenError,
  onCustomSizeChange,
  onStepSize,
  onResetToFit,
  onToggleFocusBoard,
  onToggleFullscreen,
}) => {
  const maxRange = Math.max(DEFAULT_MIN_BOARD_SIZE, maxAllowedWidth);
  const isAtMin = currentSize <= DEFAULT_MIN_BOARD_SIZE;
  const isAtMax = currentSize >= maxAllowedWidth;

  return (
    <div
      className="board-controls mb-1.5 sm:mb-2 flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs select-none"
      role="toolbar"
      aria-label="Chessboard view and sizing controls"
    >
      {/* Sizing Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-[200px]">
        {/* Fit button */}
        <button
          type="button"
          onClick={onResetToFit}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
            sizeMode === 'fit'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
          }`}
          aria-label="Reset board size to fit screen"
          aria-pressed={sizeMode === 'fit'}
          title="Fit to screen (auto-size to window)"
        >
          Fit
        </button>

        {/* Step decrease */}
        <button
          type="button"
          onClick={() => onStepSize(-BOARD_SIZE_STEP)}
          disabled={isAtMin}
          className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent font-bold transition-colors"
          aria-label="Decrease board size"
          title="Decrease board size"
        >
          −
        </button>

        {/* Live slider */}
        <input
          type="range"
          min={DEFAULT_MIN_BOARD_SIZE}
          max={maxRange}
          step={8}
          value={Math.min(currentSize, maxRange)}
          onChange={(e) => onCustomSizeChange(Number(e.target.value))}
          className="board-size-slider flex-1 min-w-[64px] max-w-[140px] h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
          aria-label="Board size"
          aria-valuemin={DEFAULT_MIN_BOARD_SIZE}
          aria-valuemax={maxRange}
          aria-valuenow={currentSize}
          aria-valuetext={`${currentSize} pixels${sizeMode === 'fit' ? ' (auto-fit)' : ''}`}
        />

        {/* Step increase */}
        <button
          type="button"
          onClick={() => onStepSize(BOARD_SIZE_STEP)}
          disabled={isAtMax}
          className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent font-bold transition-colors"
          aria-label="Increase board size"
          title="Increase board size"
        >
          +
        </button>

        {/* Pixel readout */}
        <span
          className="font-mono text-[11px] text-slate-400 min-w-[38px] text-right"
          aria-hidden="true"
        >
          {currentSize}px
        </span>
      </div>

      {/* Mode Controls: Focus & Fullscreen */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <div className="h-4 w-px bg-slate-800 mx-0.5" aria-hidden="true" />

        {/* Focus Board Toggle */}
        <button
          type="button"
          onClick={onToggleFocusBoard}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
            focusBoard
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
          }`}
          aria-label={focusBoard ? 'Exit focus board mode' : 'Focus board (collapse sidebar)'}
          aria-pressed={focusBoard}
          title={focusBoard ? 'Exit focus mode (restore sidebar)' : 'Focus board (expand board, collapse sidebar)'}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {focusBoard ? (
              <path d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M10 4v6m0 0H4m6 0L3 3m10 7h6m-6 0V4m0 6l7-7" />
            ) : (
              <path d="M15 3h6v6m0 0l-7 7m7-7L14 10M9 21H3v-6m0 0l7-7m-7 7l7-7" />
            )}
          </svg>
          <span className="hidden sm:inline">Focus</span>
        </button>

        {/* Fullscreen Toggle */}
        {isFullscreenSupported && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }`}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={isFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
              ) : (
                <path d="M3 8V5a2 2 0 012-2h3m11 0h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3" />
              )}
            </svg>
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>
        )}
      </div>

      {fullscreenError && (
        <div
          role="alert"
          className="w-full mt-1 flex items-center justify-between rounded border border-amber-500/40 bg-amber-950/80 px-2.5 py-1 text-[11px] text-amber-200"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span aria-hidden="true" className="shrink-0">⚠️</span>
            <span className="truncate">{fullscreenError}</span>
          </div>
          {onClearFullscreenError && (
            <button
              type="button"
              onClick={onClearFullscreenError}
              className="ml-2 shrink-0 text-amber-400 hover:text-white font-bold px-1"
              aria-label="Dismiss fullscreen error"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
};
