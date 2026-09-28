import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_CUSTOM_BOARD_SIZE,
  DEFAULT_MIN_BOARD_SIZE,
  BOARD_SIZE_STEP,
} from './board-sizing.js';

export type BoardSizeMode = 'fit' | 'custom';

export interface BoardDisplayPreferences {
  sizeMode: BoardSizeMode;
  customSize: number;
  focusBoard: boolean;
}

export const STORAGE_KEY_BOARD_DISPLAY = 'lan_chess_board_display';

export const DEFAULT_BOARD_DISPLAY_PREFERENCES: BoardDisplayPreferences = {
  sizeMode: 'fit',
  customSize: DEFAULT_CUSTOM_BOARD_SIZE,
  focusBoard: false,
};

/**
 * Load persisted board display preferences from localStorage with fallback guards.
 */
export function loadBoardDisplayPreferences(): BoardDisplayPreferences {
  if (typeof window === 'undefined') return DEFAULT_BOARD_DISPLAY_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_BOARD_DISPLAY);
    if (!raw) return DEFAULT_BOARD_DISPLAY_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<BoardDisplayPreferences>;

    const sizeMode: BoardSizeMode = parsed.sizeMode === 'custom' ? 'custom' : 'fit';
    const customSize =
      typeof parsed.customSize === 'number' &&
      !Number.isNaN(parsed.customSize) &&
      parsed.customSize >= DEFAULT_MIN_BOARD_SIZE &&
      parsed.customSize <= 1600
        ? Math.round(parsed.customSize)
        : DEFAULT_BOARD_DISPLAY_PREFERENCES.customSize;
    const focusBoard = Boolean(parsed.focusBoard);

    return { sizeMode, customSize, focusBoard };
  } catch {
    return DEFAULT_BOARD_DISPLAY_PREFERENCES;
  }
}

/**
 * Persist board display preferences locally. Never throws.
 */
export function saveBoardDisplayPreferences(prefs: BoardDisplayPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_BOARD_DISPLAY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or incognito restrictions
  }
}

export interface UseBoardDisplayReturn {
  displayPrefs: BoardDisplayPreferences;
  sizeMode: BoardSizeMode;
  customSize: number;
  focusBoard: boolean;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  isFocusDrawerOpen: boolean;
  setSizeMode: (mode: BoardSizeMode) => void;
  setCustomSize: (size: number) => void;
  stepCustomSize: (delta: number, currentActiveSize?: number) => void;
  resetToFit: () => void;
  toggleFocusBoard: () => void;
  toggleFullscreen: () => Promise<void>;
  openFocusDrawer: () => void;
  closeFocusDrawer: () => void;
  toggleFocusDrawer: () => void;
}

export function useBoardDisplay(
  initial?: Partial<BoardDisplayPreferences>
): UseBoardDisplayReturn {
  const [displayPrefs, setDisplayPrefs] = useState<BoardDisplayPreferences>(() => {
    const loaded = loadBoardDisplayPreferences();
    return {
      ...loaded,
      ...initial,
    };
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return Boolean(document.fullscreenElement);
  });

  const [isFocusDrawerOpen, setIsFocusDrawerOpen] = useState<boolean>(false);

  const isFullscreenSupported =
    typeof document !== 'undefined' &&
    (Boolean(document.fullscreenEnabled) ||
      'webkitFullscreenEnabled' in document);

  // Sync fullscreen state
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcut listener for Escape to close drawer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusDrawerOpen) {
        setIsFocusDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusDrawerOpen]);

  const updatePrefs = useCallback((updater: (prev: BoardDisplayPreferences) => BoardDisplayPreferences) => {
    setDisplayPrefs((prev) => {
      const next = updater(prev);
      saveBoardDisplayPreferences(next);
      return next;
    });
  }, []);

  const setSizeMode = useCallback(
    (mode: BoardSizeMode) => {
      updatePrefs((prev) => ({ ...prev, sizeMode: mode }));
    },
    [updatePrefs]
  );

  const setCustomSize = useCallback(
    (size: number) => {
      const clamped = Math.max(DEFAULT_MIN_BOARD_SIZE, Math.min(1600, Math.round(size)));
      updatePrefs((prev) => ({
        ...prev,
        sizeMode: 'custom',
        customSize: clamped,
      }));
    },
    [updatePrefs]
  );

  const stepCustomSize = useCallback(
    (delta: number, currentActiveSize?: number) => {
      updatePrefs((prev) => {
        const base =
          prev.sizeMode === 'custom'
            ? prev.customSize
            : currentActiveSize ?? prev.customSize;
        const newSize = Math.max(
          DEFAULT_MIN_BOARD_SIZE,
          Math.min(1600, Math.round(base + delta))
        );
        return {
          ...prev,
          sizeMode: 'custom',
          customSize: newSize,
        };
      });
    },
    [updatePrefs]
  );

  const resetToFit = useCallback(() => {
    updatePrefs((prev) => ({
      ...prev,
      sizeMode: 'fit',
    }));
  }, [updatePrefs]);

  const toggleFocusBoard = useCallback(() => {
    updatePrefs((prev) => {
      const nextFocus = !prev.focusBoard;
      return {
        ...prev,
        focusBoard: nextFocus,
      };
    });
  }, [updatePrefs]);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen request might be rejected by browser permission / gesture policy
    }
  }, []);

  const openFocusDrawer = useCallback(() => setIsFocusDrawerOpen(true), []);
  const closeFocusDrawer = useCallback(() => setIsFocusDrawerOpen(false), []);
  const toggleFocusDrawer = useCallback(() => setIsFocusDrawerOpen((prev) => !prev), []);

  return {
    displayPrefs,
    sizeMode: displayPrefs.sizeMode,
    customSize: displayPrefs.customSize,
    focusBoard: displayPrefs.focusBoard,
    isFullscreen,
    isFullscreenSupported,
    isFocusDrawerOpen,
    setSizeMode,
    setCustomSize,
    stepCustomSize,
    resetToFit,
    toggleFocusBoard,
    toggleFullscreen,
    openFocusDrawer,
    closeFocusDrawer,
    toggleFocusDrawer,
  };
}
