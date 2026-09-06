export interface BoardTheme {
  id: string;
  name: string;
  description?: string;
  lightSquare: string;
  darkSquare: string;
  selectedSquare: string;
  lastMoveSquare: string;
  legalMoveColor: string;
  checkSquare: string;
  checkmateSquare: string;
  isCustom?: boolean;
  isLocked?: boolean;
}

export type PieceSetId =
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'glass'
  | 'wood'
  | 'neon'
  | 'cyber'
  | 'silhouette';

export type HighlightStyleId = 'classic' | 'soft' | 'bright' | 'minimal' | 'neon';

export type UiThemeId = 'dark' | 'light' | 'midnight' | 'oled' | 'glass' | 'cyber';

export interface BoardDisplaySettings {
  pieceScale: number; // 0.8 to 1.2
  coordinates: boolean;
  coordinateStyle: 'inside' | 'outside' | 'small' | 'large';
  boardBorder: boolean;
  boardShadow: boolean;
  roundedCorners: boolean;
}

export interface SoundPreferences {
  master: boolean;
  move: boolean;
  capture: boolean;
  check: boolean;
  gameEnd: boolean;
  volume: number; // 0 to 1
}

export interface AnimationPreferences {
  enabled: boolean;
  speed: 'instant' | 'smooth' | 'fast';
}

export interface UserPreferences {
  activeThemeId: string;
  pieceSet: PieceSetId;
  highlightStyle: HighlightStyleId;
  uiTheme: UiThemeId;
  boardSettings: BoardDisplaySettings;
  sound: SoundPreferences;
  animation: AnimationPreferences;
  preferredColor: 'w' | 'b' | 'random';
  playerName: string;
  avatar: string;
}

export interface OneClickPreset {
  id: string;
  name: string;
  description: string;
  themeId: string;
  pieceSet: PieceSetId;
  highlightStyle: HighlightStyleId;
  uiTheme: UiThemeId;
}
