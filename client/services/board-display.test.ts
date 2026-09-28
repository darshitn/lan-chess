import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadBoardDisplayPreferences,
  saveBoardDisplayPreferences,
  DEFAULT_BOARD_DISPLAY_PREFERENCES,
  STORAGE_KEY_BOARD_DISPLAY,
} from './board-display.js';

function installFakeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  return store;
}

describe('board-display preferences service', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installFakeStorage();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('returns default preferences when window is undefined', () => {
    delete (globalThis as Record<string, unknown>).window;
    const prefs = loadBoardDisplayPreferences();
    expect(prefs).toEqual(DEFAULT_BOARD_DISPLAY_PREFERENCES);
  });

  it('returns default preferences when localStorage is empty', () => {
    const prefs = loadBoardDisplayPreferences();
    expect(prefs).toEqual(DEFAULT_BOARD_DISPLAY_PREFERENCES);
    expect(prefs.sizeMode).toBe('fit');
    expect(prefs.customSize).toBe(560);
    expect(prefs.focusBoard).toBe(false);
  });

  it('loads valid custom preferences successfully', () => {
    saveBoardDisplayPreferences({
      sizeMode: 'custom',
      customSize: 680,
      focusBoard: true,
    });

    const prefs = loadBoardDisplayPreferences();
    expect(prefs.sizeMode).toBe('custom');
    expect(prefs.customSize).toBe(680);
    expect(prefs.focusBoard).toBe(true);
  });

  it('falls back gracefully when localStorage contains corrupted JSON', () => {
    store.set(STORAGE_KEY_BOARD_DISPLAY, 'invalid-json{{{{');
    const prefs = loadBoardDisplayPreferences();
    expect(prefs).toEqual(DEFAULT_BOARD_DISPLAY_PREFERENCES);
  });

  it('clamps out-of-range customSize and falls back for invalid sizeMode', () => {
    store.set(
      STORAGE_KEY_BOARD_DISPLAY,
      JSON.stringify({
        sizeMode: 'invalid_mode',
        customSize: 99999, // exceeds 1600
        focusBoard: 'not_a_bool',
      })
    );

    const prefs = loadBoardDisplayPreferences();
    expect(prefs.sizeMode).toBe('fit');
    // customSize out of range defaults to default 560
    expect(prefs.customSize).toBe(560);
    expect(prefs.focusBoard).toBe(true); // Boolean('not_a_bool')
  });

  it('preserves valid customSize within allowed range', () => {
    store.set(
      STORAGE_KEY_BOARD_DISPLAY,
      JSON.stringify({
        sizeMode: 'custom',
        customSize: 720.6,
        focusBoard: false,
      })
    );

    const prefs = loadBoardDisplayPreferences();
    expect(prefs.sizeMode).toBe('custom');
    expect(prefs.customSize).toBe(721);
    expect(prefs.focusBoard).toBe(false);
  });
});
