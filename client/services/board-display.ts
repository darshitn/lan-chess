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
  fullscreenError: string | null;
  clearFullscreenError: () => void;
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

export function getFullscreenElement(doc = typeof document !== 'undefined' ? document : undefined): Element | null {
  if (!doc) return null;
  const d = doc as Document & {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? d.mozFullScreenElement ?? d.msFullscreenElement ?? null;
}

export function checkIsFullscreenSupported(doc = typeof document !== 'undefined' ? document : undefined): boolean {
  if (!doc) return false;
  const d = doc as Document & {
    webkitFullscreenEnabled?: boolean;
    mozFullScreenEnabled?: boolean;
    msFullscreenEnabled?: boolean;
  };
  if (typeof d.fullscreenEnabled === 'boolean') return d.fullscreenEnabled;
  if (typeof d.webkitFullscreenEnabled === 'boolean') return d.webkitFullscreenEnabled;
  if (typeof d.mozFullScreenEnabled === 'boolean') return d.mozFullScreenEnabled;
  if (typeof d.msFullscreenEnabled === 'boolean') return d.msFullscreenEnabled;
  return false;
}

export async function requestFullscreenOnElement(element: HTMLElement): Promise<void> {
  const el = element as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    webkitRequestFullScreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
  if (typeof el.requestFullscreen === 'function') {
    return el.requestFullscreen();
  }
  if (typeof el.webkitRequestFullscreen === 'function') {
    return Promise.resolve(el.webkitRequestFullscreen());
  }
  if (typeof el.webkitRequestFullScreen === 'function') {
    return Promise.resolve(el.webkitRequestFullScreen());
  }
  if (typeof el.mozRequestFullScreen === 'function') {
    return Promise.resolve(el.mozRequestFullScreen());
  }
  if (typeof el.msRequestFullscreen === 'function') {
    return Promise.resolve(el.msRequestFullscreen());
  }
  throw new Error('Fullscreen API is not supported in this browser environment.');
}

export async function exitFullscreenOnDocument(doc = typeof document !== 'undefined' ? document : undefined): Promise<void> {
  if (!doc) return;
  const d = doc as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitCancelFullScreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  if (typeof d.exitFullscreen === 'function') {
    return d.exitFullscreen();
  }
  if (typeof d.webkitExitFullscreen === 'function') {
    return Promise.resolve(d.webkitExitFullscreen());
  }
  if (typeof d.webkitCancelFullScreen === 'function') {
    return Promise.resolve(d.webkitCancelFullScreen());
  }
  if (typeof d.mozCancelFullScreen === 'function') {
    return Promise.resolve(d.mozCancelFullScreen());
  }
  if (typeof d.msExitFullscreen === 'function') {
    return Promise.resolve(d.msExitFullscreen());
  }
  throw new Error('Fullscreen exit is not supported in this browser environment.');
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
    return Boolean(getFullscreenElement());
  });

  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [isFocusDrawerOpen, setIsFocusDrawerOpen] = useState<boolean>(false);

  const isFullscreenSupported = checkIsFullscreenSupported();

  const clearFullscreenError = useCallback(() => {
    setFullscreenError(null);
  }, []);

  // Sync fullscreen state & handle browser events
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
      setFullscreenError(null);
    };

    const handleFullscreenError = () => {
      setFullscreenError('Fullscreen request was declined or blocked by browser security policy.');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    document.addEventListener('fullscreenerror', handleFullscreenError);
    document.addEventListener('webkitfullscreenerror', handleFullscreenError);
    document.addEventListener('mozfullscreenerror', handleFullscreenError);
    document.addEventListener('MSFullscreenError', handleFullscreenError);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

      document.removeEventListener('fullscreenerror', handleFullscreenError);
      document.removeEventListener('webkitfullscreenerror', handleFullscreenError);
      document.removeEventListener('mozfullscreenerror', handleFullscreenError);
      document.removeEventListener('MSFullscreenError', handleFullscreenError);
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
    if (!checkIsFullscreenSupported()) {
      setFullscreenError('Fullscreen is not supported or is blocked in this browser environment.');
      return;
    }
    try {
      setFullscreenError(null);
      if (getFullscreenElement()) {
        await exitFullscreenOnDocument();
      } else {
        await requestFullscreenOnElement(document.documentElement);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Fullscreen request was declined or blocked by browser permissions.';
      console.warn('[board-display] Fullscreen toggle failed:', message);
      setFullscreenError(message);
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
    fullscreenError,
    clearFullscreenError,
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
