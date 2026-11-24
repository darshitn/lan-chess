import React from 'react';
import {
  DEFAULT_MIN_BOARD_SIZE,
  BOARD_SIZE_STEP,
} from '../services/board-sizing.js';
import type { BoardSizeMode, UseBoardDisplayReturn } from '../services/board-display.js';

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
  onToggleFocusBoard?: () => void;
  onToggleFullscreen: () => void;
}

interface BoardDisplayControlsProps {
  display: UseBoardDisplayReturn;
  measure: Pick<BoardControlsProps, 'currentSize' | 'fitSize' | 'maxAllowedWidth'>;
  allowFocus?: boolean;
}

export function BoardDisplayControls({ display, measure, allowFocus = true }: BoardDisplayControlsProps) {
  return (
    <BoardControls
      {...measure}
      sizeMode={display.sizeMode}
      focusBoard={allowFocus && display.focusBoard}
      isFullscreen={display.isFullscreen}
      isFullscreenSupported={display.isFullscreenSupported}
      fullscreenError={display.fullscreenError}
      onClearFullscreenError={display.clearFullscreenError}
      onSetSizeMode={display.setSizeMode}
      onCustomSizeChange={display.setCustomSize}
      onStepSize={(delta) => display.stepCustomSize(delta, measure.currentSize)}
      onResetToFit={display.resetToFit}
      onToggleFocusBoard={allowFocus ? display.toggleFocusBoard : undefined}
      onToggleFullscreen={display.toggleFullscreen}
    />
  );
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
  const maxRange = Math.max(1, maxAllowedWidth);
  const minRange = Math.min(DEFAULT_MIN_BOARD_SIZE, maxRange);
  const isAtMin = currentSize <= minRange;
  const isAtMax = currentSize >= maxRange;

  return (
    <div
      className="board-controls"
      role="toolbar"
      aria-label="Chessboard view and sizing controls"
    >
      {/* Sizing Controls */}
      <div className="board-size-tools">
        {/* Fit button */}
        <button
          type="button"
          onClick={onResetToFit}
          className="board-tool"
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
          className="board-tool board-step"
          aria-label="Decrease board size"
          title="Decrease board size"
        >
          −
        </button>

        {/* Live slider */}
        <input
          type="range"
          min={minRange}
          max={maxRange}
          step={1}
          value={Math.min(currentSize, maxRange)}
          onChange={(e) => onCustomSizeChange(Number(e.target.value))}
          className="board-range"
          aria-label="Board size"
          aria-valuemin={minRange}
          aria-valuemax={maxRange}
          aria-valuenow={currentSize}
          aria-valuetext={`${currentSize} pixels${sizeMode === 'fit' ? ' (auto-fit)' : ''}`}
        />

        {/* Step increase */}
        <button
          type="button"
          onClick={() => onStepSize(BOARD_SIZE_STEP)}
          disabled={isAtMax}
          className="board-tool board-step"
          aria-label="Increase board size"
          title="Increase board size"
        >
          +
        </button>

        {/* Pixel readout */}
        <span
          className="board-dimension"
          aria-hidden="true"
        >
          {currentSize}px
        </span>
      </div>

      {/* Mode Controls: Focus & Fullscreen */}
      <div className="board-mode-tools">

        {/* Focus Board Toggle */}
        {onToggleFocusBoard && <button
          type="button"
          onClick={onToggleFocusBoard}
          className="board-tool"
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
        </button>}

        {/* Fullscreen Toggle */}
        {isFullscreenSupported && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="board-tool"
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
            <span>{fullscreenError}</span>
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
