import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILTIN_BOARD_THEMES,
  getActiveBoardTheme,
  loadCustomThemes,
  loadUserPreferences,
  DEFAULT_PREFERENCES,
} from './preferences.js';

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

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('preferences service', () => {
  it('provides at least 12 standard built-in themes and locked preview themes', () => {
    expect(BUILTIN_BOARD_THEMES.length).toBeGreaterThanOrEqual(18);

    const standardThemes = BUILTIN_BOARD_THEMES.filter((t) => !t.isLocked);
    expect(standardThemes.length).toBeGreaterThanOrEqual(12);

    const lockedThemes = BUILTIN_BOARD_THEMES.filter((t) => t.isLocked);
    expect(lockedThemes.length).toBeGreaterThanOrEqual(6);
  });

  it('retrieves active theme by ID or falls back to wooden default', () => {
    const classic = getActiveBoardTheme('classic');
    expect(classic.id).toBe('classic');
    expect(classic.name).toBe('Classic');

    const fallback = getActiveBoardTheme('non-existent-id');
    expect(fallback.id).toBe('wooden');
  });

  it('finds custom themes when provided', () => {
    const custom = {
      id: 'custom-1',
      name: 'My Emerald',
      lightSquare: '#ffffff',
      darkSquare: '#004400',
      selectedSquare: '#ffff00',
      lastMoveSquare: '#00ff00',
      legalMoveColor: '#000000',
      checkSquare: '#ff0000',
      checkmateSquare: '#aa0000',
      isCustom: true,
    };

    const found = getActiveBoardTheme('custom-1', [custom]);
    expect(found.id).toBe('custom-1');
    expect(found.name).toBe('My Emerald');
  });

  it('has valid default preferences', () => {
    expect(DEFAULT_PREFERENCES.sound.master).toBe(true);
    expect(DEFAULT_PREFERENCES.boardSettings.coordinates).toBe(true);
    expect(DEFAULT_PREFERENCES.uiTheme).toBe('dark');
  });

  it('returns defaults when no preferences are stored', () => {
    installFakeStorage();
    expect(loadUserPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('coerces corrupted stored values to safe defaults', () => {
    installFakeStorage({
      'lan-chess-user-preferences-v2': JSON.stringify({
        playerName: 123,
        pieceSet: 'not-a-piece-set',
        uiTheme: 'burnt-orange',
        sound: { volume: 5, master: 'yes' },
        boardSettings: { pieceScale: 99, coordinateStyle: 'diagonal' },
      }),
    });
    const prefs = loadUserPreferences();
    expect(prefs.playerName).toBe(DEFAULT_PREFERENCES.playerName);
    expect(prefs.pieceSet).toBe(DEFAULT_PREFERENCES.pieceSet);
    expect(prefs.uiTheme).toBe('dark');
    expect(prefs.sound.volume).toBe(1);
    expect(prefs.sound.master).toBe(true);
    expect(prefs.boardSettings.pieceScale).toBe(1.2);
    expect(prefs.boardSettings.coordinateStyle).toBe('inside');
  });

  it('returns defaults for corrupted JSON', () => {
    installFakeStorage({ 'lan-chess-user-preferences-v2': '{{broken' });
    expect(loadUserPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('drops incomplete custom themes and sanitizes colors', () => {
    installFakeStorage({
      'lan-chess-custom-board-themes-v2': JSON.stringify([
        { id: 'broken', name: 'No Colors' },
        'garbage',
        {
          id: 'ok',
          name: 'Valid Theme',
          lightSquare: '#ffffff',
          darkSquare: 'not-a-color',
          selectedSquare: '#ffff00',
          lastMoveSquare: '#00ff00',
          legalMoveColor: 'rgba(0,0,0,0.3)',
          checkSquare: '#ff0000',
          checkmateSquare: '#aa0000',
        },
      ]),
    });
    const themes = loadCustomThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0].id).toBe('ok');
    expect(themes[0].darkSquare).toBe('#b58863'); // replaced with a safe fallback
    expect(themes[0].isCustom).toBe(true);
  });
});
