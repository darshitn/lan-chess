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
  sizeMode?: 'fit' | 'custom';
  customSize?: number;
  focusBoard?: boolean;
}

export const DEFAULT_MIN_BOARD_SIZE = 280;
export const DEFAULT_MAX_BOARD_SIZE = 736;
export const FOCUS_MAX_BOARD_SIZE = 1200;
export const DEFAULT_SAFE_BOTTOM_SPACING = 16;
export const DEFAULT_CUSTOM_BOARD_SIZE = 560;
export const BOARD_SIZE_STEP = 32;

/**
 * Computes the optimal board dimension when fitting cleanly to viewport and container.
 */
export function calculateFitSize(options: BoardSizeOptions): number {
  const {
    viewportWidth,
    viewportHeight,
    containerWidth,
    topOverhead,
    bottomOverhead,
    minBoardSize = DEFAULT_MIN_BOARD_SIZE,
    maxBoardSize = options.focusBoard ? FOCUS_MAX_BOARD_SIZE : DEFAULT_MAX_BOARD_SIZE,
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

  // Cap at maximum design size (e.g. 736px / max-w-[46rem], or 1200px in focus mode)
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

export function calculateBoardSize(options: BoardSizeOptions): number {
  const {
    sizeMode = 'fit',
    customSize,
    containerWidth,
    minBoardSize = DEFAULT_MIN_BOARD_SIZE,
  } = options;

  const availableWidth = Math.max(0, containerWidth);
  const fitSize = calculateFitSize(options);

  if (sizeMode === 'custom' && typeof customSize === 'number' && !Number.isNaN(customSize)) {
    // Custom size is bounded by minBoardSize and availableWidth to strictly prevent horizontal overflow
    let target = Math.max(minBoardSize, customSize);
    if (availableWidth > 0 && availableWidth < target) {
      target = availableWidth;
    }
    return Math.floor(target);
  }

  return fitSize;
}
