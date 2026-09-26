import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { calculateBoardSize, DEFAULT_MIN_BOARD_SIZE, DEFAULT_MAX_BOARD_SIZE, DEFAULT_SAFE_BOTTOM_SPACING } from '../services/board-sizing.js';

interface ResponsiveBoardFrameProps {
  children: React.ReactNode;
  minSize?: number;
  maxSize?: number;
  safeBottomSpacing?: number;
}

export const ResponsiveBoardFrame: React.FC<ResponsiveBoardFrameProps> = ({
  children,
  minSize = DEFAULT_MIN_BOARD_SIZE,
  maxSize = DEFAULT_MAX_BOARD_SIZE,
  safeBottomSpacing = DEFAULT_SAFE_BOTTOM_SPACING,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<number | null>(null);

  const measureAndResize = () => {
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

    const newSize = calculateBoardSize({
      viewportWidth,
      viewportHeight,
      containerWidth,
      topOverhead,
      bottomOverhead,
      minBoardSize: minSize,
      maxBoardSize: maxSize,
      safeBottomSpacing,
    });

    setBoardSize((prev) => (prev === newSize ? prev : newSize));
  };

  useLayoutEffect(() => {
    measureAndResize();
  }, []);

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
  }, [minSize, maxSize, safeBottomSpacing]);

  return (
    <div
      ref={frameRef}
      className="responsive-board-frame mx-auto w-full flex justify-center items-center"
      style={{
        maxWidth: boardSize ? `${boardSize}px` : undefined,
      }}
    >
      <div
        className="w-full flex justify-center"
        style={{ width: boardSize ? `${boardSize}px` : '100%' }}
      >
        {children}
      </div>
    </div>
  );
};
