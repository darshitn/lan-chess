import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  calculateBoardSize,
  calculateFitSize,
  DEFAULT_MIN_BOARD_SIZE,
  DEFAULT_MAX_BOARD_SIZE,
  FOCUS_MAX_BOARD_SIZE,
  DEFAULT_SAFE_BOTTOM_SPACING,
} from '../services/board-sizing.js';
import type { BoardSizeMode } from '../services/board-display.js';
import './board-layout.css';

export interface ResponsiveBoardFrameProps {
  children: React.ReactNode;
  minSize?: number;
  maxSize?: number;
  safeBottomSpacing?: number;
  sizeMode?: BoardSizeMode;
  customSize?: number;
  focusBoard?: boolean;
  onMeasuredSizeChange?: (info: {
    currentSize: number;
    fitSize: number;
    maxAllowedWidth: number;
  }) => void;
  onResizeCustom?: (newSize: number) => void;
  showDragHandle?: boolean;
}

export const ResponsiveBoardFrame: React.FC<ResponsiveBoardFrameProps> = ({
  children,
  minSize = DEFAULT_MIN_BOARD_SIZE,
  maxSize,
  safeBottomSpacing = DEFAULT_SAFE_BOTTOM_SPACING,
  sizeMode = 'fit',
  customSize,
  focusBoard = false,
  onMeasuredSizeChange,
  onResizeCustom,
  showDragHandle = true,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<number | null>(null);
  const [widthLimit, setWidthLimit] = useState<number | null>(null);
  const dragStart = useRef<{ id: number; x: number; y: number; size: number } | null>(null);
  const lastReportedRef = useRef<{ currentSize: number; fitSize: number; maxAllowedWidth: number } | null>(null);

  const effectiveMaxSize = maxSize ?? (focusBoard ? FOCUS_MAX_BOARD_SIZE : DEFAULT_MAX_BOARD_SIZE);

  const measureAndResize = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const parent = frame.parentElement;
    if (!parent) return;

    // Use window.innerWidth to align with CSS media queries (e.g. Tailwind lg: breakpoint >= 1024px)
    const viewportWidth = window.innerWidth;
    const visual = window.visualViewport;
    const viewportHeight = visual?.scale === 1 ? visual.height : window.innerHeight;
    const style = window.getComputedStyle(parent);
    const innerWidth = parent.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    if (innerWidth <= 0) return;
    const containerWidth = Math.floor(Math.min(innerWidth, effectiveMaxSize));

    // Real positions include wrapped toolbars, grid gaps, collapsed margins and notation.
    const rect = frame.getBoundingClientRect();
    const topOverhead = Math.max(0, rect.top + window.scrollY);
    const bottomOverhead = Math.max(0, parent.getBoundingClientRect().bottom - rect.bottom)
      + Math.max(0, rect.height - rect.width);

    const sizeOptions = {
      viewportWidth,
      viewportHeight,
      containerWidth,
      topOverhead,
      bottomOverhead,
      minBoardSize: minSize,
      maxBoardSize: effectiveMaxSize,
      safeBottomSpacing,
      sizeMode,
      customSize,
      focusBoard,
    };

    const fitSize = calculateFitSize(sizeOptions);
    const newSize = calculateBoardSize(sizeOptions);

    if (parent.style.getPropertyValue('--board-span') !== `${newSize}px`) {
      parent.style.setProperty('--board-span', `${newSize}px`);
    }
    setBoardSize((prev) => (prev === newSize ? prev : newSize));
    setWidthLimit(containerWidth);

    const last = lastReportedRef.current;
    if (
      !last ||
      last.currentSize !== newSize ||
      last.fitSize !== fitSize ||
      last.maxAllowedWidth !== containerWidth
    ) {
      const nextReport = {
        currentSize: newSize,
        fitSize,
        maxAllowedWidth: Math.max(0, containerWidth),
      };
      lastReportedRef.current = nextReport;
      if (onMeasuredSizeChange) {
        onMeasuredSizeChange(nextReport);
      }
    }
  }, [
    minSize,
    effectiveMaxSize,
    safeBottomSpacing,
    sizeMode,
    customSize,
    focusBoard,
    onMeasuredSizeChange,
  ]);

  useLayoutEffect(() => {
    measureAndResize();
  }, [measureAndResize]);

  useEffect(() => {
    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        measureAndResize();
      });
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    document.addEventListener('webkitfullscreenchange', handleResize);

    const frame = frameRef.current;
    const parent = frame?.parentElement;
    let resizeObserver: ResizeObserver | null = null;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(parent);
      if (frame) resizeObserver.observe(frame);
      resizeObserver.observe(document.body);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
      document.removeEventListener('webkitfullscreenchange', handleResize);
      resizeObserver?.disconnect();
    };
  }, [measureAndResize]);

  const maxDragSize = widthLimit ?? effectiveMaxSize;
  const minDragSize = Math.min(minSize, maxDragSize);
  const resizeTo = (size: number) =>
    onResizeCustom?.(Math.min(maxDragSize, Math.max(minDragSize, Math.round(size))));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary || !onResizeCustom) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY, size: boardSize ?? 560 };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || start.id !== e.pointerId) return;
    // Centering means the right edge travels half the change in overall width.
    const dx = (e.clientX - start.x) * 2;
    const dy = e.clientY - start.y;
    resizeTo(start.size + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onResizeCustom) return;
    const current = boardSize ?? customSize ?? 560;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      resizeTo(current + 16);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      resizeTo(current - 16);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      resizeTo(e.key === 'Home' ? minDragSize : maxDragSize);
    }
  };

  const shouldRenderDragHandle = Boolean(showDragHandle && onResizeCustom);

  return (
    <div
      ref={frameRef}
      className="responsive-board-frame relative mx-auto w-full flex justify-center items-center"
      style={{
        maxWidth: boardSize ? `${boardSize}px` : undefined,
      }}
    >
      <div
        className="relative w-full flex justify-center"
        style={{ width: boardSize ? `${boardSize}px` : '100%' }}
      >
        {children}

        {/* Tactile drag resize handle located directly outside the squares at the bottom-right */}
        {shouldRenderDragHandle && (
          <div
            className="board-resize-handle absolute -bottom-3 -right-3 z-20 flex items-center justify-center w-6 h-6 rounded-md bg-slate-900/90 border border-slate-700 hover:border-amber-400 text-slate-400 hover:text-amber-300 active:text-amber-200 cursor-se-resize touch-none select-none transition-colors shadow-sm"
            role="slider"
            aria-label="Drag to resize chessboard"
            aria-valuemin={minDragSize}
            aria-valuemax={maxDragSize}
            aria-valuenow={boardSize ?? customSize ?? 560}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onLostPointerCapture={() => { dragStart.current = null; }}
            onKeyDown={handleKeyDown}
            title="Drag to resize chessboard"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="4.5" cy="8" r="1.2" />
              <circle cx="8" cy="4.5" r="1.2" />
              <circle cx="1" cy="8" r="1.2" />
              <circle cx="4.5" cy="4.5" r="1.2" />
              <circle cx="8" cy="1" r="1.2" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
