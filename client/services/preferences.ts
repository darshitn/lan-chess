import type {
  BoardTheme,
  OneClickPreset,
  UserPreferences,
} from '../types/preferences.js';

export const BUILTIN_BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional tournament green and cream styling',
    lightSquare: '#ebecd0',
    darkSquare: '#739552',
    selectedSquare: '#f6f669',
    lastMoveSquare: '#bbcb2b',
    legalMoveColor: 'rgba(0, 0, 0, 0.25)',
    checkSquare: '#e55c57',
    checkmateSquare: '#cc2929',
  },
  {
    id: 'wooden',
    name: 'Wooden',
    description: 'Warm hand-crafted oak and walnut tones',
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    selectedSquare: '#fbbf24',
    lastMoveSquare: '#d7cd58',
    legalMoveColor: 'rgba(15, 23, 42, 0.28)',
    checkSquare: '#e55c57',
    checkmateSquare: '#cc2929',
  },
  {
    id: 'dark-wood',
    name: 'Dark Wood',
    description: 'Deep mahogany and rosewood texture',
    lightSquare: '#cca574',
    darkSquare: '#85582f',
    selectedSquare: '#eab308',
    lastMoveSquare: '#b4833e',
    legalMoveColor: 'rgba(30, 20, 10, 0.35)',
    checkSquare: '#dc2626',
    checkmateSquare: '#991b1b',
  },
  {
    id: 'marble',
    name: 'Marble',
    description: 'Polished grey and white Italian marble',
    lightSquare: '#e2e8f0',
    darkSquare: '#94a3b8',
    selectedSquare: '#60a5fa',
    lastMoveSquare: '#cbd5e1',
    legalMoveColor: 'rgba(51, 65, 85, 0.3)',
    checkSquare: '#f87171',
    checkmateSquare: '#dc2626',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep nocturnal blue and slate contrast',
    lightSquare: '#475569',
    darkSquare: '#1e293b',
    selectedSquare: '#38bdf8',
    lastMoveSquare: '#64748b',
    legalMoveColor: 'rgba(248, 250, 252, 0.2)',
    checkSquare: '#f43f5e',
    checkmateSquare: '#be123c',
  },
  {
    id: 'royal',
    name: 'Royal',
    description: 'Regal violet and ivory majesty',
    lightSquare: '#e9d5ff',
    darkSquare: '#6b21a8',
    selectedSquare: '#facc15',
    lastMoveSquare: '#c084fc',
    legalMoveColor: 'rgba(255, 255, 255, 0.25)',
    checkSquare: '#f43f5e',
    checkmateSquare: '#9f1239',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool aquamarine and deep nautical cyan',
    lightSquare: '#cffafe',
    darkSquare: '#0891b2',
    selectedSquare: '#38bdf8',
    lastMoveSquare: '#67e8f9',
    legalMoveColor: 'rgba(15, 23, 42, 0.25)',
    checkSquare: '#fb7185',
    checkmateSquare: '#e11d48',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Earthy moss and deep pine foliage',
    lightSquare: '#dcfce7',
    darkSquare: '#166534',
    selectedSquare: '#facc15',
    lastMoveSquare: '#86efac',
    legalMoveColor: 'rgba(20, 40, 20, 0.28)',
    checkSquare: '#f87171',
    checkmateSquare: '#b91c1c',
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'High-octane arcade synthwave glow',
    lightSquare: '#334155',
    darkSquare: '#0f172a',
    selectedSquare: '#00f0ff',
    lastMoveSquare: '#ff007f',
    legalMoveColor: 'rgba(0, 240, 255, 0.4)',
    checkSquare: '#ff0055',
    checkmateSquare: '#ff0000',
  },
  {
    id: 'cyber',
    name: 'Cyber',
    description: 'Futuristic matrix grid and sharp highlights',
    lightSquare: '#1e293b',
    darkSquare: '#020617',
    selectedSquare: '#22d3ee',
    lastMoveSquare: '#0284c7',
    legalMoveColor: 'rgba(34, 211, 238, 0.35)',
    checkSquare: '#f43f5e',
    checkmateSquare: '#9f1239',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean Scandinavian monochrome balance',
    lightSquare: '#f8fafc',
    darkSquare: '#cbd5e1',
    selectedSquare: '#94a3b8',
    lastMoveSquare: '#e2e8f0',
    legalMoveColor: 'rgba(15, 23, 42, 0.2)',
    checkSquare: '#ef4444',
    checkmateSquare: '#b91c1c',
  },
  {
    id: 'stone',
    name: 'Stone',
    description: 'Cool silver squares on warm stone gray',
    lightSquare: '#cdd1d4',
    darkSquare: '#7d7461',
    selectedSquare: '#f5c542',
    lastMoveSquare: '#dbd07a',
    legalMoveColor: 'rgba(20, 25, 30, 0.3)',
    checkSquare: '#e55c57',
    checkmateSquare: '#cc2929',
  },
  {
    id: 'golden',
    name: 'Golden',
    description: 'Gilded championship amber and gold',
    lightSquare: '#fef3c7',
    darkSquare: '#d97706',
    selectedSquare: '#fbbf24',
    lastMoveSquare: '#fde68a',
    legalMoveColor: 'rgba(120, 53, 15, 0.28)',
    checkSquare: '#e11d48',
    checkmateSquare: '#881337',
  },
  // Premium preview themes (Locked)
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Volcanic glass luster with silver trim',
    lightSquare: '#27272a',
    darkSquare: '#09090b',
    selectedSquare: '#a1a1aa',
    lastMoveSquare: '#3f3f46',
    legalMoveColor: 'rgba(255, 255, 255, 0.2)',
    checkSquare: '#ef4444',
    checkmateSquare: '#991b1b',
    isLocked: true,
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    description: '24-karat luxury leaf and satin black',
    lightSquare: '#fef08a',
    darkSquare: '#713f12',
    selectedSquare: '#eab308',
    lastMoveSquare: '#ca8a04',
    legalMoveColor: 'rgba(234, 179, 8, 0.35)',
    checkSquare: '#f43f5e',
    checkmateSquare: '#be123c',
    isLocked: true,
  },
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Woven carbon fiber and tungsten weave',
    lightSquare: '#3f3f46',
    darkSquare: '#18181b',
    selectedSquare: '#71717a',
    lastMoveSquare: '#52525b',
    legalMoveColor: 'rgba(255, 255, 255, 0.25)',
    checkSquare: '#ef4444',
    checkmateSquare: '#b91c1c',
    isLocked: true,
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Vibrant gemstone facets and deep jade',
    lightSquare: '#a7f3d0',
    darkSquare: '#065f46',
    selectedSquare: '#34d399',
    lastMoveSquare: '#6ee7b7',
    legalMoveColor: 'rgba(6, 95, 70, 0.3)',
    checkSquare: '#f43f5e',
    checkmateSquare: '#be123c',
    isLocked: true,
  },
  {
    id: 'cyber-red',
    name: 'Cyber Red',
    description: 'High-contrast stealth crimson and obsidian',
    lightSquare: '#450a0a',
    darkSquare: '#1c0505',
    selectedSquare: '#ef4444',
    lastMoveSquare: '#991b1b',
    legalMoveColor: 'rgba(239, 68, 68, 0.4)',
    checkSquare: '#ff0033',
    checkmateSquare: '#990000',
    isLocked: true,
  },
  {
    id: 'luxury-wood',
    name: 'Luxury Wood',
    description: 'Rare aged burl wood inlay and brass edges',
    lightSquare: '#d4a373',
    darkSquare: '#603813',
    selectedSquare: '#f59e0b',
    lastMoveSquare: '#b45309',
    legalMoveColor: 'rgba(96, 56, 19, 0.35)',
    checkSquare: '#e11d48',
    checkmateSquare: '#881337',
    isLocked: true,
  },
];

export const ONE_CLICK_PRESETS: OneClickPreset[] = [
  {
    id: 'preset-classic',
    name: 'Classic Chess',
    description: 'Tournament green board with traditional Staunton feel',
    themeId: 'classic',
    pieceSet: 'classic',
    highlightStyle: 'classic',
    uiTheme: 'dark',
  },
  {
    id: 'preset-midnight',
    name: 'Midnight Chess',
    description: 'Nocturnal blue board with modern crisp styling',
    themeId: 'midnight',
    pieceSet: 'modern',
    highlightStyle: 'soft',
    uiTheme: 'midnight',
  },
  {
    id: 'preset-royal',
    name: 'Royal Chess',
    description: 'Opulent purple and gold majesty',
    themeId: 'royal',
    pieceSet: 'classic',
    highlightStyle: 'bright',
    uiTheme: 'dark',
  },
  {
    id: 'preset-cyber',
    name: 'Cyber Chess',
    description: 'Futuristic high-contrast neon grid aesthetic',
    themeId: 'neon',
    pieceSet: 'neon',
    highlightStyle: 'neon',
    uiTheme: 'cyber',
  },
  {
    id: 'preset-wooden',
    name: 'Wooden Chess',
    description: 'Natural hand-carved wood warmth',
    themeId: 'wooden',
    pieceSet: 'wood',
    highlightStyle: 'classic',
    uiTheme: 'dark',
  },
  {
    id: 'preset-minimal',
    name: 'Minimal Chess',
    description: 'Pure distraction-free Scandinavian monochrome',
    themeId: 'minimal',
    pieceSet: 'minimal',
    highlightStyle: 'minimal',
    uiTheme: 'oled',
  },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  activeThemeId: 'wooden',
  pieceSet: 'classic',
  highlightStyle: 'classic',
  uiTheme: 'dark',
  boardSettings: {
    pieceScale: 1.0,
    coordinates: true,
    coordinateStyle: 'inside',
    boardBorder: true,
    boardShadow: true,
    roundedCorners: true,
  },
  sound: {
    master: true,
    move: true,
    capture: true,
    check: true,
    gameEnd: true,
    volume: 0.8,
  },
  animation: {
    enabled: true,
    speed: 'smooth',
  },
  preferredColor: 'random',
  playerName: 'Player',
  avatar: '♟',
  recentlyUsedTimeControls: [],
};

const STORAGE_KEYS = {
  PREFERENCES: 'lan-chess-user-preferences-v2',
  CUSTOM_THEMES: 'lan-chess-custom-board-themes-v2',
};

const PIECE_SET_IDS = ['classic', 'modern', 'minimal', 'glass', 'wood', 'neon', 'cyber', 'silhouette'] as const;
const HIGHLIGHT_STYLE_IDS = ['classic', 'soft', 'bright', 'minimal', 'neon'] as const;
const UI_THEME_IDS = ['dark', 'light', 'midnight', 'oled', 'glass', 'cyber'] as const;
const COORDINATE_STYLES = ['inside', 'outside', 'small', 'large'] as const;
const ANIMATION_SPEEDS = ['instant', 'smooth', 'fast'] as const;
const PREFERRED_COLORS = ['w', 'b', 'random'] as const;

type OneOf<T extends readonly string[]> = T[number];

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: OneOf<T>): OneOf<T> {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as OneOf<T> : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function stringOr(value: unknown, fallback: string, maxLength = 64): string {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : fallback;
}

/** A theme color must be a plain hex/rgba color — never a URL or CSS function. */
function colorOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(trimmed)) return trimmed;
  return fallback;
}

export function loadUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const storedBoard = (parsed.boardSettings ?? {}) as Record<string, unknown>;
    const storedSound = (parsed.sound ?? {}) as Record<string, unknown>;
    const storedAnimation = (parsed.animation ?? {}) as Record<string, unknown>;

    return {
      activeThemeId: stringOr(parsed.activeThemeId, DEFAULT_PREFERENCES.activeThemeId),
      pieceSet: oneOf(parsed.pieceSet, PIECE_SET_IDS, DEFAULT_PREFERENCES.pieceSet),
      highlightStyle: oneOf(parsed.highlightStyle, HIGHLIGHT_STYLE_IDS, DEFAULT_PREFERENCES.highlightStyle),
      uiTheme: oneOf(parsed.uiTheme, UI_THEME_IDS, DEFAULT_PREFERENCES.uiTheme),
      boardSettings: {
        pieceScale: clampedNumber(storedBoard.pieceScale, DEFAULT_PREFERENCES.boardSettings.pieceScale, 0.8, 1.2),
        coordinates: booleanOr(storedBoard.coordinates, DEFAULT_PREFERENCES.boardSettings.coordinates),
        coordinateStyle: oneOf(storedBoard.coordinateStyle, COORDINATE_STYLES, DEFAULT_PREFERENCES.boardSettings.coordinateStyle),
        boardBorder: booleanOr(storedBoard.boardBorder, DEFAULT_PREFERENCES.boardSettings.boardBorder),
        boardShadow: booleanOr(storedBoard.boardShadow, DEFAULT_PREFERENCES.boardSettings.boardShadow),
        roundedCorners: booleanOr(storedBoard.roundedCorners, DEFAULT_PREFERENCES.boardSettings.roundedCorners),
      },
      sound: {
        master: booleanOr(storedSound.master, DEFAULT_PREFERENCES.sound.master),
        move: booleanOr(storedSound.move, DEFAULT_PREFERENCES.sound.move),
        capture: booleanOr(storedSound.capture, DEFAULT_PREFERENCES.sound.capture),
        check: booleanOr(storedSound.check, DEFAULT_PREFERENCES.sound.check),
        gameEnd: booleanOr(storedSound.gameEnd, DEFAULT_PREFERENCES.sound.gameEnd),
        volume: clampedNumber(storedSound.volume, DEFAULT_PREFERENCES.sound.volume, 0, 1),
      },
      animation: {
        enabled: booleanOr(storedAnimation.enabled, DEFAULT_PREFERENCES.animation.enabled),
        speed: oneOf(storedAnimation.speed, ANIMATION_SPEEDS, DEFAULT_PREFERENCES.animation.speed),
      },
      preferredColor: oneOf(parsed.preferredColor, PREFERRED_COLORS, DEFAULT_PREFERENCES.preferredColor),
      playerName: stringOr(parsed.playerName, DEFAULT_PREFERENCES.playerName, 24),
      avatar: stringOr(parsed.avatar, DEFAULT_PREFERENCES.avatar, 8),
      recentlyUsedTimeControls: Array.isArray(parsed.recentlyUsedTimeControls)
        ? parsed.recentlyUsedTimeControls.filter(
            (tc: unknown): tc is string =>
              typeof tc === 'string' && /^\d+\+(0|[1-9]\d*)$/.test(tc) || tc === 'unlimited'
          ).slice(0, 3)
        : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
  } catch {
    // Graceful fallback
  }
}

function isValidThemeColorPair(value: unknown): boolean {
  const t = value as Record<string, unknown>;
  return (
    typeof t.lightSquare === 'string' &&
    typeof t.darkSquare === 'string' &&
    typeof t.selectedSquare === 'string' &&
    typeof t.lastMoveSquare === 'string' &&
    typeof t.legalMoveColor === 'string' &&
    typeof t.checkSquare === 'string' &&
    typeof t.checkmateSquare === 'string'
  );
}

export function loadCustomThemes(): BoardTheme[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.CUSTOM_THEMES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop entries missing required color fields — an incomplete theme would
    // render invisible board squares.
    return parsed
      .filter((t): t is BoardTheme => Boolean(t) && typeof t === 'object' && isValidThemeColorPair(t))
      .map((t) => ({
        ...t,
        lightSquare: colorOr(t.lightSquare, '#f0d9b5'),
        darkSquare: colorOr(t.darkSquare, '#b58863'),
        selectedSquare: colorOr(t.selectedSquare, '#fbbf24'),
        lastMoveSquare: colorOr(t.lastMoveSquare, '#d7cd58'),
        legalMoveColor: colorOr(t.legalMoveColor, 'rgba(15, 23, 42, 0.28)'),
        checkSquare: colorOr(t.checkSquare, '#e55c57'),
        checkmateSquare: colorOr(t.checkmateSquare, '#cc2929'),
        isCustom: true,
      }));
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: BoardTheme[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.CUSTOM_THEMES,
      JSON.stringify(themes.map((t) => ({ ...t, isCustom: true })))
    );
  } catch {
    // Graceful fallback
  }
}

export function getAllThemes(customThemes: BoardTheme[]): BoardTheme[] {
  return [...BUILTIN_BOARD_THEMES, ...customThemes];
}

export function getActiveBoardTheme(
  themeId: string,
  customThemes: BoardTheme[] = []
): BoardTheme {
  const all = getAllThemes(customThemes);
  const found = all.find((t) => t.id === themeId);
  // Stable fallback by id — never by array position.
  return found ?? all.find((t) => t.id === 'wooden') ?? BUILTIN_BOARD_THEMES[0];
}

export function applyUiThemeToDom(themeId: string): void {
  if (typeof document === 'undefined') return;
  // Unknown theme ids from storage must not leave the document unstyled.
  const validIds: readonly string[] = UI_THEME_IDS;
  const safeId = validIds.includes(themeId) ? themeId : 'dark';
  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-light', 'theme-midnight', 'theme-oled', 'theme-glass', 'theme-cyber');
  root.classList.add(`theme-${safeId}`);
}
