import React, { useState } from 'react';
import type { BoardTheme } from '../../types/preferences.js';
import { ChessPiece, type PieceSymbol } from '../chess/ChessPiece.js';
import type { PlayerColor } from '../../../shared/types.js';

interface CustomBoardBuilderProps {
  customThemes: BoardTheme[];
  activeThemeId: string;
  onSaveTheme: (theme: BoardTheme) => void;
  onDeleteTheme: (themeId: string) => void;
  onSelectTheme: (themeId: string) => void;
}

const DEFAULT_BUILDER_STATE: Omit<BoardTheme, 'id'> = {
  name: 'My Custom Board',
  lightSquare: '#ebecd0',
  darkSquare: '#739552',
  selectedSquare: '#f6f669',
  lastMoveSquare: '#bbcb2b',
  legalMoveColor: 'rgba(0, 0, 0, 0.28)',
  checkSquare: '#e55c57',
  checkmateSquare: '#cc2929',
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function hexToLuminance(hex: string): number {
  if (!HEX_COLOR_PATTERN.test(hex)) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function calculateContrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

function newThemeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `custom-${crypto.randomUUID()}`
    : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const CustomBoardBuilder: React.FC<CustomBoardBuilderProps> = ({
  customThemes,
  activeThemeId,
  onSaveTheme,
  onDeleteTheme,
  onSelectTheme,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [themeName, setThemeName] = useState(DEFAULT_BUILDER_STATE.name);
  const [lightSquare, setLightSquare] = useState(DEFAULT_BUILDER_STATE.lightSquare);
  const [darkSquare, setDarkSquare] = useState(DEFAULT_BUILDER_STATE.darkSquare);
  const [selectedSquare, setSelectedSquare] = useState(DEFAULT_BUILDER_STATE.selectedSquare);
  const [lastMoveSquare, setLastMoveSquare] = useState(DEFAULT_BUILDER_STATE.lastMoveSquare);
  const [checkSquare, setCheckSquare] = useState(DEFAULT_BUILDER_STATE.checkSquare);
  const [colorError, setColorError] = useState<string | null>(null);

  const handleSave = () => {
    // Free-text color input must produce a real color, or board squares would
    // render transparent/invisible.
    const colors = { lightSquare, darkSquare, selectedSquare, lastMoveSquare, checkSquare };
    const invalid = Object.entries(colors).filter(([, v]) => !HEX_COLOR_PATTERN.test(v));
    if (invalid.length > 0) {
      setColorError(
        `Invalid color: ${invalid.map(([k]) => k).join(', ')}. Use 6-digit hex like #739552.`
      );
      return;
    }
    setColorError(null);
    const trimmed = themeName.trim() || 'Custom Theme';
    const id = editingId ?? newThemeId();
    const newTheme: BoardTheme = {
      id,
      name: trimmed,
      description: 'Custom created board theme',
      lightSquare,
      darkSquare,
      selectedSquare,
      lastMoveSquare,
      legalMoveColor: 'rgba(0, 0, 0, 0.28)',
      checkSquare,
      checkmateSquare: '#cc2929',
      isCustom: true,
    };
    onSaveTheme(newTheme);
    setEditingId(null);
    setThemeName(DEFAULT_BUILDER_STATE.name);
  };

  const handleEdit = (theme: BoardTheme) => {
    setEditingId(theme.id);
    setThemeName(theme.name);
    setLightSquare(theme.lightSquare);
    setDarkSquare(theme.darkSquare);
    setSelectedSquare(theme.selectedSquare);
    setLastMoveSquare(theme.lastMoveSquare);
    setCheckSquare(theme.checkSquare);
  };

  const handleDuplicate = (theme: BoardTheme) => {
    const duplicated: BoardTheme = {
      ...theme,
      id: newThemeId(),
      name: `${theme.name} (Copy)`,
      isCustom: true,
    };
    onSaveTheme(duplicated);
  };

  const handleReset = () => {
    setEditingId(null);
    setThemeName(DEFAULT_BUILDER_STATE.name);
    setLightSquare(DEFAULT_BUILDER_STATE.lightSquare);
    setDarkSquare(DEFAULT_BUILDER_STATE.darkSquare);
    setSelectedSquare(DEFAULT_BUILDER_STATE.selectedSquare);
    setLastMoveSquare(DEFAULT_BUILDER_STATE.lastMoveSquare);
    setCheckSquare(DEFAULT_BUILDER_STATE.checkSquare);
  };

  // 4x4 Mini preview sample squares
  const sampleSquares: Array<{
    row: number;
    col: number;
    type: 'light' | 'dark';
    isSelected?: boolean;
    isLastMove?: boolean;
    isCheck?: boolean;
    piece?: { type: PieceSymbol; color: PlayerColor };
  }> = [
    { row: 0, col: 0, type: 'light', piece: { type: 'r', color: 'b' } },
    { row: 0, col: 1, type: 'dark', piece: { type: 'n', color: 'b' } },
    { row: 0, col: 2, type: 'light', piece: { type: 'b', color: 'b' } },
    { row: 0, col: 3, type: 'dark', piece: { type: 'q', color: 'b' } },
    { row: 1, col: 0, type: 'dark', isLastMove: true },
    { row: 1, col: 1, type: 'light' },
    { row: 1, col: 2, type: 'dark' },
    { row: 1, col: 3, type: 'light', isCheck: true, piece: { type: 'k', color: 'b' } },
    { row: 2, col: 0, type: 'light' },
    { row: 2, col: 1, type: 'dark', isSelected: true, piece: { type: 'p', color: 'b' } },
    { row: 2, col: 2, type: 'light' },
    { row: 2, col: 3, type: 'dark' },
    { row: 3, col: 0, type: 'dark', piece: { type: 'r', color: 'w' } },
    { row: 3, col: 1, type: 'light' },
    { row: 3, col: 2, type: 'dark', piece: { type: 'b', color: 'w' } },
    { row: 3, col: 3, type: 'light', piece: { type: 'k', color: 'w' } },
  ];

  const squareContrast = calculateContrastRatio(lightSquare, darkSquare);
  const hasLowContrast = squareContrast < 1.35;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Editor controls */}
        <div className="space-y-4">
          <div>
            <label htmlFor="custom-theme-name" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Theme Name
            </label>
            <input
              id="custom-theme-name"
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              className="field text-sm"
              placeholder="E.g., Mint Chocolate"
              maxLength={24}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="light-square-color" className="block text-xs font-semibold text-slate-300">Light Square</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="light-square-color"
                  type="color"
                  value={lightSquare}
                  onChange={(e) => setLightSquare(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={lightSquare}
                  onChange={(e) => setLightSquare(e.target.value)}
                  className="field text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label htmlFor="dark-square-color" className="block text-xs font-semibold text-slate-300">Dark Square</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="dark-square-color"
                  type="color"
                  value={darkSquare}
                  onChange={(e) => setDarkSquare(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={darkSquare}
                  onChange={(e) => setDarkSquare(e.target.value)}
                  className="field text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label htmlFor="selected-square-color" className="block text-xs font-semibold text-slate-300">Selected Square</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="selected-square-color"
                  type="color"
                  value={selectedSquare}
                  onChange={(e) => setSelectedSquare(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={selectedSquare}
                  onChange={(e) => setSelectedSquare(e.target.value)}
                  className="field text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label htmlFor="last-move-square-color" className="block text-xs font-semibold text-slate-300">Last Move</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="last-move-square-color"
                  type="color"
                  value={lastMoveSquare}
                  onChange={(e) => setLastMoveSquare(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={lastMoveSquare}
                  onChange={(e) => setLastMoveSquare(e.target.value)}
                  className="field text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="col-span-2">
              <label htmlFor="check-square-color" className="block text-xs font-semibold text-slate-300">Check Indicator</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="check-square-color"
                  type="color"
                  value={checkSquare}
                  onChange={(e) => setCheckSquare(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={checkSquare}
                  onChange={(e) => setCheckSquare(e.target.value)}
                  className="field text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {hasLowContrast && (
            <div className="rounded-lg bg-amber-950/70 p-2.5 text-xs text-amber-200 border border-amber-700/60 flex items-start gap-2">
              <span className="text-sm leading-none">⚠️</span>
              <div>
                <p className="font-semibold text-amber-300">Low square contrast ({squareContrast.toFixed(1)}:1)</p>
                <p className="text-[11px] text-amber-200/80">Squares may be difficult to distinguish during fast play. Consider widening the brightness difference.</p>
              </div>
            </div>
          )}

          {colorError && (
            <p className="rounded-lg bg-rose-950/80 p-2 text-xs text-rose-300 border border-rose-800/60" role="alert">
              {colorError}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="action-button action-primary flex-1 text-sm font-bold"
            >
              {editingId ? 'Update Theme' : 'Save Custom Theme'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="action-button action-secondary text-sm"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Preview</p>
          <div className="mt-3 aspect-square w-52 overflow-hidden rounded-lg border-2 border-slate-700 shadow-xl">
            <div className="grid h-full w-full grid-cols-4">
              {sampleSquares.map((sq, i) => {
                let bg = sq.type === 'light' ? lightSquare : darkSquare;
                if (sq.isSelected) bg = selectedSquare;
                if (sq.isLastMove) bg = lastMoveSquare;
                if (sq.isCheck) bg = checkSquare;

                return (
                  <div
                    key={i}
                    style={{ backgroundColor: bg }}
                    className="flex items-center justify-center p-0.5 relative"
                  >
                    {sq.piece && (
                      <div className="w-9 h-9 flex items-center justify-center">
                        <ChessPiece type={sq.piece.type} color={sq.piece.color} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            Colors update instantly as you pick
          </p>
        </div>
      </div>

      {/* Custom themes management list */}
      {customThemes.length > 0 && (
        <div className="border-t border-slate-800 pt-4">
          <h3 className="text-sm font-bold text-slate-300">Your Saved Themes</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customThemes.map((theme) => {
              const isActive = theme.id === activeThemeId;
              return (
                <div
                  key={theme.id}
                  className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${
                    isActive ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{theme.name}</span>
                    <div className="h-8 w-8 overflow-hidden rounded border border-slate-700 shadow-inner grid grid-cols-2 grid-rows-2">
                      <div className="flex items-center justify-center p-0.5" style={{ backgroundColor: theme.lightSquare }}>
                        <ChessPiece type="n" color="w" className="w-full h-full" />
                      </div>
                      <div className="flex items-center justify-center p-0.5" style={{ backgroundColor: theme.darkSquare }}>
                        <ChessPiece type="p" color="b" className="w-full h-full" />
                      </div>
                      <div className="flex items-center justify-center p-0.5" style={{ backgroundColor: theme.darkSquare }}>
                        <ChessPiece type="r" color="w" className="w-full h-full" />
                      </div>
                      <div className="flex items-center justify-center p-0.5" style={{ backgroundColor: theme.lightSquare }}>
                        <ChessPiece type="k" color="b" className="w-full h-full" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectTheme(theme.id)}
                      className={`flex-1 rounded px-2 py-1 text-xs font-bold ${
                        isActive ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isActive ? 'Active' : 'Apply'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(theme)}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(theme)}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTheme(theme.id)}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
