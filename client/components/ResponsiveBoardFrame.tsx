import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  calculateBoardSize,
  calculateFitSize,
  DEFAULT_MIN_BOARD_SIZE,
  DEFAULT_MAX_BOARD_SIZE,
  DEFAULT_SAFE_BOTTOM_SPACING,
} from '../services/board-sizing.js';
import type { BoardSizeMode } from '../services/board-display.js';

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
  maxSize = DEFAULT_MAX_BOARD_SIZE,
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

  const measureAndResize = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const parent = frame.parentElement;
    if (!parent) return;

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const containerWidth = parent.clientWidth;

    // Measure parent position relative to page top (unscrolled)
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const parentRect = parent.getBoundingClientRect();
    const parentTopUnscrolled = Math.max(0, parentRect.top + scrollY);

    // Sum sibling heights before and after this frame
    let topSiblingsHeight = 0;
    let bottomSiblingsHeight = 0;
    let foundFrame = false;

    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i] as HTMLElement;
      if (child === frame) {
        foundFrame = true;
        continue;
      }
      const rect = child.getBoundingClientRect();
      const style = window.getComputedStyle(child);
      const vMargin = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      const totalH = rect.height + vMargin;

      if (!foundFrame) {
        topSiblingsHeight += totalH;
      } else {
        bottomSiblingsHeight += totalH;
      }
    }

    const topOverhead = parentTopUnscrolled + topSiblingsHeight;
    const bottomOverhead = bottomSiblingsHeight;

    const sizeOptions = {
      viewportWidth,
      viewportHeight,
      containerWidth,
      topOverhead,
      bottomOverhead,
      minBoardSize: minSize,
      maxBoardSize: maxSize,
      safeBottomSpacing,
      sizeMode,
      customSize,
      focusBoard,
    };

    const fitSize = calculateFitSize(sizeOptions);
    const newSize = calculateBoardSize(sizeOptions);

    setBoardSize((prev) => (prev === newSize ? prev : newSize));

    if (onMeasuredSizeChange) {
      onMeasuredSizeChange({
        currentSize: newSize,
        fitSize,
        maxAllowedWidth: Math.max(0, containerWidth),
      });
    }
  }, [
    minSize,
    maxSize,
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

    const frame = frameRef.current;
    const parent = frame?.parentElement;
    let resizeObserver: ResizeObserver | null = null;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(parent);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [measureAndResize]);

  // Handle pointer down on the external drag resize handle
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onResizeCustom) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialSize = boardSize ?? 560;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      const rawSize = initialSize + delta;
      onResizeCustom(rawSize);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch {
        // Pointer might already have been released
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onResizeCustom) return;
    const current = boardSize ?? 560;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onResizeCustom(current + 16);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onResizeCustom(current - 16);
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
            aria-valuemin={minSize}
            aria-valuenow={boardSize ?? 560}
            tabIndex={0}
            onPointerDown={handlePointerDown}
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
