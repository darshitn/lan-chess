import React, { useState } from 'react';
import type {
  BoardTheme,
  HighlightStyleId,
  PieceSetId,
  UiThemeId,
  UserPreferences,
} from '../../types/preferences.js';
import {
  BUILTIN_BOARD_THEMES,
  ONE_CLICK_PRESETS,
  applyUiThemeToDom,
} from '../../services/preferences.js';
import { invalidateSoundVolumeCache } from '../../utils/sound.js';
import { useModalBehavior } from '../../utils/modal-behavior.js';
import { CustomBoardBuilder } from '../themes/CustomBoardBuilder.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  customThemes: BoardTheme[];
  onUpdatePreferences: (newPrefs: UserPreferences) => void;
  onSaveCustomTheme: (theme: BoardTheme) => void;
  onDeleteCustomTheme: (themeId: string) => void;
}

const PIECE_SETS: Array<{ id: PieceSetId; name: string; preview: string }> = [
  { id: 'classic', name: 'Classic', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'modern', name: 'Modern', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'minimal', name: 'Minimal', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'glass', name: 'Glass', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'wood', name: 'Wood', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'neon', name: 'Neon', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'cyber', name: 'Cyber', preview: '♔ ♕ ♖ ♗ ♘ ♙' },
  { id: 'silhouette', name: 'Silhouette', preview: '♚ ♛ ♜ ♝ ♞ ♟' },
];

const HIGHLIGHT_STYLES: Array<{ id: HighlightStyleId; name: string; desc: string }> = [
  { id: 'classic', name: 'Classic', desc: 'Standard gold border & soft dot' },
  { id: 'soft', name: 'Soft', desc: 'Subtle translucent amber glow' },
  { id: 'bright', name: 'Bright', desc: 'Vivid high-contrast highlighting' },
  { id: 'minimal', name: 'Minimal', desc: 'Clean razor-thin white border' },
  { id: 'neon', name: 'Neon', desc: 'Vibrant cyan synthwave glow' },
];

const UI_THEMES: Array<{ id: UiThemeId; name: string; bg: string }> = [
  { id: 'dark', name: 'Dark Slate', bg: '#020617' },
  { id: 'light', name: 'Clean Light', bg: '#f1f5f9' },
  { id: 'midnight', name: 'Midnight Blue', bg: '#090d16' },
  { id: 'oled', name: 'OLED Black', bg: '#000000' },
  { id: 'glass', name: 'Frosted Glass', bg: '#111827' },
  { id: 'cyber', name: 'Cyber Neon', bg: '#0a0a14' },
];

const AVATARS = ['♟', '♞', '♝', '♜', '♛', '♚', '⚡', '🛡️', '⚔️', '🦅'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  customThemes,
  onUpdatePreferences,
  onSaveCustomTheme,
  onDeleteCustomTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'builder' | 'sound' | 'gameplay' | 'analysis'>('appearance');
  const [lockedModalNotice, setLockedModalNotice] = useState<string | null>(null);
  const modalRef = useModalBehavior(onClose, true, isOpen);

  if (!isOpen) return null;

  const handleApplyPreset = (presetId: string) => {
    const preset = ONE_CLICK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const updated: UserPreferences = {
      ...preferences,
      activeThemeId: preset.themeId,
      pieceSet: preset.pieceSet,
      highlightStyle: preset.highlightStyle,
      uiTheme: preset.uiTheme,
    };
    onUpdatePreferences(updated);
    applyUiThemeToDom(preset.uiTheme);
  };

  const handleSelectTheme = (theme: BoardTheme) => {
    if (theme.isLocked) {
      setLockedModalNotice(`Premium Theme: "${theme.name}" is a concept preview and locked in this version.`);
      return;
    }
    onUpdatePreferences({ ...preferences, activeThemeId: theme.id });
  };

  const handleUiThemeChange = (themeId: UiThemeId) => {
    onUpdatePreferences({ ...preferences, uiTheme: themeId });
    applyUiThemeToDom(themeId);
  };

  return (
    <div
      className="promotion-backdrop z-50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Customization & Options</p>
            <h2 className="text-xl font-black text-white">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          {[
            { id: 'appearance', label: '🎨 Appearance' },
            { id: 'builder', label: '🛠️ Custom Board' },
            { id: 'sound', label: '🔊 Sound' },
            { id: 'gameplay', label: '⚙️ Gameplay' },
            { id: 'analysis', label: '🔍 Analysis' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`border-b-2 px-3.5 py-3 text-xs font-bold transition-all sm:text-sm ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-200">
          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-8">
              {/* One-Click Presets */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">One-Click Presets</h3>
                <p className="mt-0.5 text-xs text-slate-400">Instant full visual styles tailored for various aesthetics.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {ONE_CLICK_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p.id)}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left transition-all hover:border-amber-400/80 hover:bg-slate-800/80"
                    >
                      <span className="font-bold text-white text-sm">{p.name}</span>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">{p.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Board Themes */}
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Board Themes</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('builder')}
                    className="text-xs font-semibold text-amber-300 hover:underline"
                  >
                    + Create Custom Board
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {BUILTIN_BOARD_THEMES.map((theme) => {
                    const isSelected = preferences.activeThemeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme)}
                        className={`flex flex-col items-center justify-between rounded-xl border p-2.5 text-center transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/10 shadow-md shadow-amber-500/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex h-7 w-14 overflow-hidden rounded-md border border-slate-700 shadow-inner">
                          <div className="w-1/2" style={{ backgroundColor: theme.lightSquare }} />
                          <div className="w-1/2" style={{ backgroundColor: theme.darkSquare }} />
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-xs font-bold text-white">{theme.name}</span>
                          {theme.isLocked && <span className="text-[10px]" title="Locked preview">🔒</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Piece Sets */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Piece Sets</h3>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {PIECE_SETS.map((set) => {
                    const isSelected = preferences.pieceSet === set.id;
                    return (
                      <button
                        key={set.id}
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, pieceSet: set.id })}
                        className={`rounded-xl border p-2.5 text-center transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-lg font-serif text-white tracking-widest">{set.preview}</span>
                        <p className="mt-1 text-xs font-bold text-slate-300">{set.name}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Highlight Styles */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Highlight Styles</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {HIGHLIGHT_STYLES.map((h) => {
                    const isSelected = preferences.highlightStyle === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, highlightStyle: h.id })}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold text-white">{h.name}</span>
                        <p className="text-[11px] text-slate-400">{h.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* UI Themes */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Application UI Themes</h3>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {UI_THEMES.map((t) => {
                    const isSelected = preferences.uiTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleUiThemeChange(t.id)}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full border border-slate-700 shadow" style={{ backgroundColor: t.bg }} />
                        <span className="text-xs font-bold text-white">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Board Display Elements */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Display Options</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-xs font-semibold text-slate-300">Board Coordinates</span>
                    <input
                      type="checkbox"
                      checked={preferences.boardSettings.coordinates}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          boardSettings: { ...preferences.boardSettings, coordinates: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded accent-amber-400"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-xs font-semibold text-slate-300">Coordinate Size</span>
                    <select
                      value={preferences.boardSettings.coordinateStyle}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          boardSettings: {
                            ...preferences.boardSettings,
                            coordinateStyle: e.target.value as 'inside' | 'outside' | 'small' | 'large',
                          },
                        })
                      }
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                    >
                      <option value="inside">Standard</option>
                      <option value="small">Small</option>
                      <option value="large">Large</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-xs font-semibold text-slate-300">Board Border & Shell</span>
                    <input
                      type="checkbox"
                      checked={preferences.boardSettings.boardBorder}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          boardSettings: { ...preferences.boardSettings, boardBorder: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded accent-amber-400"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-xs font-semibold text-slate-300">Rounded Corners</span>
                    <input
                      type="checkbox"
                      checked={preferences.boardSettings.roundedCorners}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          boardSettings: { ...preferences.boardSettings, roundedCorners: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded accent-amber-400"
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {/* CUSTOM BOARD BUILDER TAB */}
          {activeTab === 'builder' && (
            <CustomBoardBuilder
              customThemes={customThemes}
              activeThemeId={preferences.activeThemeId}
              onSaveTheme={onSaveCustomTheme}
              onDeleteTheme={onDeleteCustomTheme}
              onSelectTheme={(id) => onUpdatePreferences({ ...preferences, activeThemeId: id })}
            />
          )}

          {/* SOUND TAB */}
          {activeTab === 'sound' && (
            <div className="space-y-4 max-w-lg">
              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div>
                  <span className="text-sm font-bold text-white">Master Sound</span>
                  <p className="text-xs text-slate-400">Toggle all application audio effects</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.sound.master}
                  onChange={(e) =>
                    onUpdatePreferences({
                      ...preferences,
                      sound: { ...preferences.sound, master: e.target.checked },
                    })
                  }
                  className="h-5 w-5 rounded accent-amber-400"
                />
              </label>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Master Volume</span>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {Math.round(preferences.sound.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(preferences.sound.volume * 100)}
                  disabled={!preferences.sound.master}
                  aria-label="Master volume"
                  onChange={(e) => {
                    const volume = Number(e.target.value) / 100;
                    invalidateSoundVolumeCache();
                    onUpdatePreferences({
                      ...preferences,
                      sound: { ...preferences.sound, volume },
                    });
                  }}
                  className="mt-2 w-full accent-amber-400"
                />
              </div>

              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Individual Sound Cues</span>
                {([
                  { key: 'move', label: 'Move Clicks' },
                  { key: 'capture', label: 'Piece Captures' },
                  { key: 'check', label: 'Check Warnings' },
                  { key: 'gameEnd', label: 'Victory & Defeat Chords' },
                ] as const).map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-slate-300">{item.label}</span>
                    <input
                      type="checkbox"
                      disabled={!preferences.sound.master}
                      checked={preferences.sound[item.key]}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          sound: {
                            ...preferences.sound,
                            [item.key]: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 rounded accent-amber-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* GAMEPLAY TAB */}
          {activeTab === 'gameplay' && (
            <div className="space-y-5 max-w-lg">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Default Orientation</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { val: 'w', label: 'White' },
                    { val: 'b', label: 'Black' },
                    { val: 'random', label: 'Auto (My Color)' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => onUpdatePreferences({ ...preferences, preferredColor: opt.val as 'w' | 'b' | 'random' })}
                      className={`rounded-lg border p-2 text-xs font-bold ${
                        preferences.preferredColor === opt.val
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Player Profile</label>
                <div className="mt-2 flex gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={preferences.playerName}
                      onChange={(e) => onUpdatePreferences({ ...preferences, playerName: e.target.value })}
                      className="field text-sm"
                      placeholder="Player Name"
                      maxLength={24}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {AVATARS.slice(0, 5).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, avatar: a })}
                        className={`h-9 w-9 rounded-lg border text-base ${
                          preferences.avatar === a ? 'border-amber-400 bg-amber-400/20' : 'border-slate-800 bg-slate-950/60'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
            <div className="space-y-4 max-w-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Stockfish Engine Settings</h3>
              <p className="text-xs text-slate-400">
                Game analysis runs fully offline in your browser using the bundled Stockfish WASM engine.
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-300">
                  The analysis search depth is selected inside the game review screen (Quick 10 / Standard 12 / Deep 15),
                  next to the <span className="font-bold text-amber-300">Analyze Game</span> button.
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  Recommended: Depth 12 gives reliable move evaluations and blunder detection without long waits.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Locked Modal Notice */}
        {lockedModalNotice && (
          <div className="border-t border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-300">{lockedModalNotice}</p>
              <button
                type="button"
                onClick={() => setLockedModalNotice(null)}
                className="action-button action-secondary px-3 py-1 text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 bg-slate-950/60 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="action-button action-primary text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
