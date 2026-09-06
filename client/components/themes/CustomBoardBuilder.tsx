import React, { useState } from 'react';
import type { BoardTheme } from '../../types/preferences.js';

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
  const sampleSquares = [
    { row: 0, col: 0, type: 'light', label: 'r' },
    { row: 0, col: 1, type: 'dark', label: 'n' },
    { row: 0, col: 2, type: 'light', label: 'b' },
    { row: 0, col: 3, type: 'dark', label: 'q' },
    { row: 1, col: 0, type: 'dark', isLastMove: true },
    { row: 1, col: 1, type: 'light' },
    { row: 1, col: 2, type: 'dark' },
    { row: 1, col: 3, type: 'light', isCheck: true, label: 'k' },
    { row: 2, col: 0, type: 'light' },
    { row: 2, col: 1, type: 'dark', isSelected: true, label: 'p' },
    { row: 2, col: 2, type: 'light' },
    { row: 2, col: 3, type: 'dark' },
    { row: 3, col: 0, type: 'dark', label: 'R' },
    { row: 3, col: 1, type: 'light' },
    { row: 3, col: 2, type: 'dark', label: 'B' },
    { row: 3, col: 3, type: 'light', label: 'K' },
  ];

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
                    className="flex items-center justify-center font-serif text-xl"
                  >
                    {sq.label && (
                      <span className={sq.label === sq.label.toUpperCase() ? 'text-white drop-shadow' : 'text-slate-900 drop-shadow'}>
                        {sq.label === 'r' && '♜'}
                        {sq.label === 'n' && '♞'}
                        {sq.label === 'b' && '♝'}
                        {sq.label === 'q' && '♛'}
                        {sq.label === 'k' && '♚'}
                        {sq.label === 'p' && '♟'}
                        {sq.label === 'R' && '♖'}
                        {sq.label === 'B' && '♗'}
                        {sq.label === 'K' && '♔'}
                      </span>
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
                    <div className="flex h-5 w-10 overflow-hidden rounded border border-slate-700">
                      <div className="w-1/2" style={{ backgroundColor: theme.lightSquare }} />
                      <div className="w-1/2" style={{ backgroundColor: theme.darkSquare }} />
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
