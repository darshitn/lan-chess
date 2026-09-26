/**
 * LAN Chess — Viewport-aware chessboard sizing service.
 *
 * Computes the optimal square board dimension given available column width
 * and remaining viewport height after accounting for visible header, player cards,
 * status controls, safe spacing, and display scaling.
 */

export interface BoardSizeOptions {
  viewportWidth: number;
  viewportHeight: number;
  containerWidth: number;
  topOverhead: number;
  bottomOverhead: number;
  minBoardSize?: number;
  maxBoardSize?: number;
  safeBottomSpacing?: number;
}

export const DEFAULT_MIN_BOARD_SIZE = 280;
export const DEFAULT_MAX_BOARD_SIZE = 736;
export const DEFAULT_SAFE_BOTTOM_SPACING = 16;

export function calculateBoardSize(options: BoardSizeOptions): number {
  const {
    viewportWidth,
    viewportHeight,
    containerWidth,
    topOverhead,
    bottomOverhead,
    minBoardSize = DEFAULT_MIN_BOARD_SIZE,
    maxBoardSize = DEFAULT_MAX_BOARD_SIZE,
    safeBottomSpacing = DEFAULT_SAFE_BOTTOM_SPACING,
  } = options;

  // Maximum width available in the board container column
  const availableWidth = Math.max(0, containerWidth);

  // Remaining vertical space in the viewport for the board
  const availableHeight = Math.max(
    0,
    viewportHeight - topOverhead - bottomOverhead - safeBottomSpacing
  );

  let targetSize: number;

  // On desktop / wide screens (>= 1024px, matching Tailwind 'lg:'), layout is side-by-side.
  // The board MUST fit within both available column width AND remaining viewport height.
  if (viewportWidth >= 1024) {
    targetSize = Math.min(availableWidth, availableHeight);
  } else {
    // In stacked mobile/tablet viewports (< 1024px):
    // Board width is primary.
    targetSize = availableWidth;
  }

  // Cap at maximum design size (e.g. 736px / max-w-[46rem])
  targetSize = Math.min(targetSize, maxBoardSize);

  // If viewport is extremely small, permit normal page scrolling instead of shrinking
  // the board below a usable minimum (unless the container itself is narrower than minBoardSize).
  targetSize = Math.max(targetSize, minBoardSize);

  // Never exceed available width to avoid horizontal scrollbars
  if (availableWidth > 0 && availableWidth < targetSize) {
    targetSize = availableWidth;
  }

  return Math.floor(targetSize);
}
