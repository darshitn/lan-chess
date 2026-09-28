import { describe, it, expect } from 'vitest';
import { calculateBoardSize, DEFAULT_MIN_BOARD_SIZE, DEFAULT_MAX_BOARD_SIZE } from './board-sizing.js';

describe('board-sizing: calculateBoardSize', () => {
  // Typical overheads for multiplayer page with header, player cards, status bar, and controls
  const standardOverheads = {
    topOverhead: 140, // header + top card + status bar
    bottomOverhead: 60, // bottom card + action buttons
    safeBottomSpacing: 16,
  };

  it('calculates full board dimension at 1920x1080 (capped by maxBoardSize)', () => {
    const size = calculateBoardSize({
      viewportWidth: 1920,
      viewportHeight: 1080,
      containerWidth: 800,
      ...standardOverheads,
    });
    // availableHeight = 1080 - 140 - 60 - 16 = 864
    // min(800, 864) = 800, capped at maxBoardSize (736)
    expect(size).toBe(DEFAULT_MAX_BOARD_SIZE);
  });

  it('fits board within available height at 1536x864 (Windows 125% on 1080p)', () => {
    const size = calculateBoardSize({
      viewportWidth: 1536,
      viewportHeight: 864,
      containerWidth: 700,
      ...standardOverheads,
    });
    // availableHeight = 864 - 140 - 60 - 16 = 648
    // min(700, 648) = 648
    expect(size).toBe(648);
  });

  it('fits board within available height at 1440x900', () => {
    const size = calculateBoardSize({
      viewportWidth: 1440,
      viewportHeight: 900,
      containerWidth: 700,
      ...standardOverheads,
    });
    // availableHeight = 900 - 140 - 60 - 16 = 684
    expect(size).toBe(684);
  });

  it('fits board without vertical overflow at 1366x768', () => {
    const size = calculateBoardSize({
      viewportWidth: 1366,
      viewportHeight: 768,
      containerWidth: 680,
      ...standardOverheads,
    });
    // availableHeight = 768 - 140 - 60 - 16 = 552
    expect(size).toBe(552);
    // Board size + overheads <= viewportHeight
    expect(size + standardOverheads.topOverhead + standardOverheads.bottomOverhead + standardOverheads.safeBottomSpacing).toBeLessThanOrEqual(768);
  });

  it('fits board without vertical overflow at 1280x800', () => {
    const size = calculateBoardSize({
      viewportWidth: 1280,
      viewportHeight: 800,
      containerWidth: 640,
      ...standardOverheads,
    });
    // availableHeight = 800 - 140 - 60 - 16 = 584
    expect(size).toBe(584);
    expect(size + standardOverheads.topOverhead + standardOverheads.bottomOverhead + standardOverheads.safeBottomSpacing).toBeLessThanOrEqual(800);
  });

  it('fits board without vertical overflow at 1280x720 (Windows 150% on 1080p)', () => {
    const size = calculateBoardSize({
      viewportWidth: 1280,
      viewportHeight: 720,
      containerWidth: 640,
      ...standardOverheads,
    });
    // availableHeight = 720 - 140 - 60 - 16 = 504
    expect(size).toBe(504);
    expect(size + standardOverheads.topOverhead + standardOverheads.bottomOverhead + standardOverheads.safeBottomSpacing).toBeLessThanOrEqual(720);
  });

  it('fits board without vertical overflow at 1024x768', () => {
    const size = calculateBoardSize({
      viewportWidth: 1024,
      viewportHeight: 768,
      containerWidth: 550,
      ...standardOverheads,
    });
    // availableHeight = 768 - 140 - 60 - 16 = 552
    // containerWidth = 550 < 552 => board is 550
    expect(size).toBe(550);
    expect(size).toBeLessThanOrEqual(550);
  });

  it('permits normal page scrolling by enforcing minBoardSize when viewport is extremely short', () => {
    const size = calculateBoardSize({
      viewportWidth: 1280,
      viewportHeight: 400, // extremely small height
      containerWidth: 600,
      ...standardOverheads,
      minBoardSize: 280,
    });
    // availableHeight = 400 - 140 - 60 - 16 = 184
    // min(600, 184) = 184, which is below minBoardSize (280)
    // Board is floored at minBoardSize (280) so pieces remain playable and page scrolls normally
    expect(size).toBe(280);
  });

  it('avoids horizontal overflow on narrow mobile screens', () => {
    const size = calculateBoardSize({
      viewportWidth: 375,
      viewportHeight: 667,
      containerWidth: 350,
      topOverhead: 120,
      bottomOverhead: 50,
      minBoardSize: 280,
    });
    // In stacked mobile mode (<1024), board takes availableWidth (350)
    expect(size).toBe(350);
    expect(size).toBeLessThanOrEqual(350);
  });

  it('never exceeds available container width even if minBoardSize is larger', () => {
    const size = calculateBoardSize({
      viewportWidth: 320,
      viewportHeight: 568,
      containerWidth: 260, // container is narrower than minBoardSize
      topOverhead: 80,
      bottomOverhead: 40,
      minBoardSize: 280,
    });
    // Must not exceed 260px container width, preventing horizontal scrollbars
    expect(size).toBe(260);
  });

  describe('custom size mode & clamping', () => {
    it('applies custom size when within available container width', () => {
      const size = calculateBoardSize({
        viewportWidth: 1280,
        viewportHeight: 800,
        containerWidth: 800,
        ...standardOverheads,
        sizeMode: 'custom',
        customSize: 640,
      });
      expect(size).toBe(640);
    });

    it('strictly clamps custom size to available container width to prevent horizontal overflow', () => {
      const size = calculateBoardSize({
        viewportWidth: 1280,
        viewportHeight: 800,
        containerWidth: 600,
        ...standardOverheads,
        sizeMode: 'custom',
        customSize: 850, // exceeds container width of 600
      });
      expect(size).toBe(600);
      expect(size).toBeLessThanOrEqual(600);
    });

    it('clamps custom size on mobile phone (390px) to prevent horizontal overflow', () => {
      const size = calculateBoardSize({
        viewportWidth: 390,
        viewportHeight: 844,
        containerWidth: 358,
        topOverhead: 120,
        bottomOverhead: 60,
        sizeMode: 'custom',
        customSize: 500, // user attempted to enlarge past phone screen
      });
      expect(size).toBe(358);
      expect(size).toBeLessThanOrEqual(358);
    });

    it('floors custom size at minBoardSize', () => {
      const size = calculateBoardSize({
        viewportWidth: 1280,
        viewportHeight: 800,
        containerWidth: 800,
        ...standardOverheads,
        sizeMode: 'custom',
        customSize: 150, // below minBoardSize
        minBoardSize: 280,
      });
      expect(size).toBe(280);
    });
  });

  describe('focus board mode', () => {
    it('allows board to expand past default 736px max up to FOCUS_MAX_BOARD_SIZE in fit mode on large screens', () => {
      const size = calculateBoardSize({
        viewportWidth: 1920,
        viewportHeight: 1200,
        containerWidth: 1100, // sidebar collapsed in focus mode
        topOverhead: 140,
        bottomOverhead: 60,
        safeBottomSpacing: 16,
        focusBoard: true,
      });
      // availableHeight = 1200 - 140 - 60 - 16 = 984
      // min(1100, 984) = 984 > 736
      expect(size).toBe(984);
      expect(size).toBeGreaterThan(736);
    });
  });
});
