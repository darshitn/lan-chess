import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILTIN_BOARD_THEMES,
  ONE_CLICK_PRESETS,
  getActiveBoardTheme,
  loadCustomThemes,
  loadUserPreferences,
  resetAppearancePreferences,
  DEFAULT_PREFERENCES,
} from './preferences.js';
import type { UserPreferences } from '../types/preferences.js';

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
  it('unlocks all built-in themes so none are locked', () => {
    expect(BUILTIN_BOARD_THEMES.length).toBeGreaterThanOrEqual(21);

    // Every built-in board theme must be completely unlocked
    const lockedThemes = BUILTIN_BOARD_THEMES.filter((t) => t.isLocked);
    expect(lockedThemes).toHaveLength(0);

    // Formally locked themes must now be present and selectable
    const formerlyLockedIds = [
      'obsidian',
      'royal-gold',
      'carbon',
      'emerald',
      'cyber-red',
      'luxury-wood',
    ];
    for (const id of formerlyLockedIds) {
      const theme = getActiveBoardTheme(id);
      expect(theme).toBeDefined();
      expect(theme.id).toBe(id);
      expect(theme.isLocked).toBeFalsy();
    }
  });

  it('includes the three recommended presets: Slate, Ivory, Walnut', () => {
    const presetIds = ONE_CLICK_PRESETS.map((p) => p.id);
    expect(presetIds).toContain('preset-slate');
    expect(presetIds).toContain('preset-ivory');
    expect(presetIds).toContain('preset-walnut');

    const slatePreset = ONE_CLICK_PRESETS.find((p) => p.id === 'preset-slate')!;
    expect(slatePreset.uiTheme).toBe('slate');
    expect(slatePreset.themeId).toBe('slate');
    expect(slatePreset.pieceSet).toBe('classic');

    const ivoryPreset = ONE_CLICK_PRESETS.find((p) => p.id === 'preset-ivory')!;
    expect(ivoryPreset.uiTheme).toBe('ivory');
    expect(ivoryPreset.themeId).toBe('ivory');

    const walnutPreset = ONE_CLICK_PRESETS.find((p) => p.id === 'preset-walnut')!;
    expect(walnutPreset.uiTheme).toBe('walnut');
    expect(walnutPreset.themeId).toBe('walnut');
  });

  it('retrieves active theme by ID or falls back to slate default', () => {
    const classic = getActiveBoardTheme('classic');
    expect(classic.id).toBe('classic');
    expect(classic.name).toBe('Classic');

    const walnut = getActiveBoardTheme('walnut');
    expect(walnut.id).toBe('walnut');
    expect(walnut.name).toBe('Walnut');

    const fallback = getActiveBoardTheme('non-existent-id');
    expect(fallback.id).toBe('slate');
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

  it('has valid default preferences matching Slate preset', () => {
    expect(DEFAULT_PREFERENCES.activeThemeId).toBe('slate');
    expect(DEFAULT_PREFERENCES.uiTheme).toBe('slate');
    expect(DEFAULT_PREFERENCES.pieceSet).toBe('classic');
    expect(DEFAULT_PREFERENCES.sound.master).toBe(true);
    expect(DEFAULT_PREFERENCES.boardSettings.coordinates).toBe(true);
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
    expect(prefs.uiTheme).toBe('slate');
    expect(prefs.sound.volume).toBe(1);
    expect(prefs.sound.master).toBe(true);
    expect(prefs.boardSettings.pieceScale).toBe(1.2);
    expect(prefs.boardSettings.coordinateStyle).toBe('inside');
  });

  it('preserves existing user preferences without overwriting explicit choices', () => {
    installFakeStorage({
      'lan-chess-user-preferences-v2': JSON.stringify({
        activeThemeId: 'cyber-red',
        pieceSet: 'modern',
        highlightStyle: 'neon',
        uiTheme: 'cyber',
        playerName: 'GrandmasterAlice',
        sound: { master: false, volume: 0.5 },
      }),
    });
    const prefs = loadUserPreferences();
    expect(prefs.activeThemeId).toBe('cyber-red');
    expect(prefs.pieceSet).toBe('modern');
    expect(prefs.highlightStyle).toBe('neon');
    expect(prefs.uiTheme).toBe('cyber');
    expect(prefs.playerName).toBe('GrandmasterAlice');
    expect(prefs.sound.master).toBe(false);
  });

  it('resetAppearancePreferences resets only appearance tokens while keeping sound, player info, and time controls', () => {
    const customUserPrefs: UserPreferences = {
      activeThemeId: 'obsidian',
      pieceSet: 'glass',
      highlightStyle: 'bright',
      uiTheme: 'oled',
      boardSettings: {
        pieceScale: 1.15,
        coordinates: false,
        coordinateStyle: 'large',
        boardBorder: false,
        boardShadow: false,
        roundedCorners: false,
      },
      sound: {
        master: false,
        volume: 0.35,
        move: false,
        capture: true,
        check: true,
        gameEnd: true,
      },
      animation: {
        enabled: false,
        speed: 'instant',
      },
      preferredColor: 'b',
      playerName: 'KasparovFan',
      avatar: '👑',
      recentlyUsedTimeControls: ['5+3', '3+2'],
    };

    const reset = resetAppearancePreferences(customUserPrefs);

    // Appearance reset to default
    expect(reset.activeThemeId).toBe(DEFAULT_PREFERENCES.activeThemeId);
    expect(reset.pieceSet).toBe(DEFAULT_PREFERENCES.pieceSet);
    expect(reset.highlightStyle).toBe(DEFAULT_PREFERENCES.highlightStyle);
    expect(reset.uiTheme).toBe(DEFAULT_PREFERENCES.uiTheme);
    expect(reset.boardSettings).toEqual(DEFAULT_PREFERENCES.boardSettings);

    // Non-appearance preferences preserved intact
    expect(reset.sound).toEqual(customUserPrefs.sound);
    expect(reset.animation).toEqual(customUserPrefs.animation);
    expect(reset.preferredColor).toBe(customUserPrefs.preferredColor);
    expect(reset.playerName).toBe(customUserPrefs.playerName);
    expect(reset.avatar).toBe(customUserPrefs.avatar);
    expect(reset.recentlyUsedTimeControls).toEqual(customUserPrefs.recentlyUsedTimeControls);
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
