import React, { useState, useRef } from 'react';
import type { TimeControl } from '../../shared/types.js';
import { formatTimeControl, TIME_CONTROL_GROUPS } from '../utils/chess-helpers.js';
import {
  type ComputerDifficulty,
  DIFFICULTY_CONFIGS,
} from '../services/computer-player.js';
import type { ComputerGameConfig, PlayerColorChoice } from '../services/computer-game-controller.js';

export type LobbyMode = 'create' | 'join' | 'computer';

const LOBBY_MODE_STORAGE_KEY = 'lan-chess-lobby-mode';

const MODES: LobbyMode[] = ['create', 'join', 'computer'];

const COMMON_TIME_CONTROLS: TimeControl[] = ['3+0', '3+2', '5+0', '10+0', '15+10', 'unlimited'];

const DIFFICULTY_LABELS: Record<ComputerDifficulty, { title: string; subtitle: string }> = {
  beginner: { title: 'Beginner', subtitle: 'Learning rules & basics' },
  easy: { title: 'Easy', subtitle: 'Relaxed casual match' },
  medium: { title: 'Medium', subtitle: 'Solid club-level play' },
  hard: { title: 'Hard', subtitle: 'Sharp tactical play' },
  expert: { title: 'Expert', subtitle: 'Deepest search (14 ply, 2s)' },
};

// Consistent, platform-independent SVG icons
const IconBroadcast: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <circle cx="12" cy="20" r="1.2" fill="currentColor" />
  </svg>
);

const IconLink: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconCpu: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
  </svg>
);

const IconDice: React.FC<{ className?: string }> = ({ className = 'h-3.5 w-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    <circle cx="16" cy="16" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
  </svg>
);

export interface LobbyProps {
  playerName: string;
  onNameChange: (name: string) => void;
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  timeControl: TimeControl;
  onTimeControlChange: (tc: TimeControl) => void;
  recentTimeControls: TimeControl[];
  allowTakebacks: boolean;
  onAllowTakebacksChange: (allow: boolean) => void;
  onCreateGame: () => void;
  onJoinGame: () => void;
  onJoinSpectator: () => void;
  onStartComputerGame: (config: ComputerGameConfig) => void;
  onOpenSettings: () => void;
  hostUrl: string | null;
  error: string | null;
  isConnecting: boolean;
  initialMode?: LobbyMode;
}

export function getStoredLobbyMode(): LobbyMode {
  if (typeof window === 'undefined') return 'create';
  try {
    const saved = window.localStorage.getItem(LOBBY_MODE_STORAGE_KEY);
    if (saved === 'create' || saved === 'join' || saved === 'computer') {
      return saved;
    }
  } catch {
    // storage unavailable
  }
  return 'create';
}

export const Lobby: React.FC<LobbyProps> = ({
  playerName,
  onNameChange,
  roomCode,
  onRoomCodeChange,
  timeControl,
  onTimeControlChange,
  recentTimeControls,
  allowTakebacks,
  onAllowTakebacksChange,
  onCreateGame,
  onJoinGame,
  onJoinSpectator,
  onStartComputerGame,
  hostUrl,
  error,
  isConnecting,
  initialMode,
}) => {
  // Remember last selected mode in localStorage, default to 'create' on first visit
  const [selectedMode, setSelectedMode] = useState<LobbyMode>(() => initialMode ?? getStoredLobbyMode());

  // Roving focus references for accessible tablist
  const tabRefs = useRef<Record<LobbyMode, HTMLButtonElement | null>>({
    create: null,
    join: null,
    computer: null,
  });

  const handleSelectMode = (mode: LobbyMode) => {
    setSelectedMode(mode);
    try {
      window.localStorage.setItem(LOBBY_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  // Keyboard navigation for horizontal tablist (ArrowRight, ArrowLeft, Home, End)
  // ArrowUp and ArrowDown are intentionally unhandled to allow normal page scrolling
  const handleTabKeyDown = (e: React.KeyboardEvent, currentMode: LobbyMode) => {
    const currentIndex = MODES.indexOf(currentMode);
    let nextIndex = -1;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % MODES.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + MODES.length) % MODES.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = MODES.length - 1;
    }

    if (nextIndex !== -1) {
      const nextMode = MODES[nextIndex];
      handleSelectMode(nextMode);
      tabRefs.current[nextMode]?.focus();
    }
  };

  // State for Create game options disclosure
  const [showAllTimeControls, setShowAllTimeControls] = useState(false);

  // State for Computer mode options
  const [computerColor, setComputerColor] = useState<PlayerColorChoice>('w');
  const [computerDifficulty, setComputerDifficulty] = useState<ComputerDifficulty>('medium');
  const [computerTimeControl, setComputerTimeControl] = useState<TimeControl>('3+2');

  const trimmedName = playerName.trim();
  const trimmedCode = roomCode.trim();

  return (
    <main className="mx-auto max-w-3xl py-5 sm:py-8">
      {/* Top Identity & Context Header */}
      <header className="mb-5 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Play Chess Together
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-300 sm:text-slate-400">
          Play with friends over your local Wi-Fi or practice offline against the computer.
        </p>

        {hostUrl && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3.5 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="text-slate-400">Host LAN Address:</span>
            <span className="font-mono font-semibold text-amber-300">{hostUrl}</span>
          </div>
        )}
      </header>

      {/* Global Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-200 shadow-sm"
        >
          <div className="flex items-center gap-2 font-semibold">
            <span>Notice</span>
          </div>
          <p className="mt-1 text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Compact Player Name Strip */}
      <section
        aria-label="Player profile"
        className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:px-4"
      >
        <div className="flex items-center gap-2">
          <label
            htmlFor="player-name-input"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Your Name
          </label>
          <span className="text-xs text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Used across all modes
          </span>
        </div>
        <div className="w-full sm:w-64">
          <input
            id="player-name-input"
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none transition-colors"
            placeholder="Enter display name"
            value={playerName}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={24}
            disabled={isConnecting}
          />
        </div>
      </section>

      {/* Three Mode Selectors with accessible WAI-ARIA tablist & arrow navigation */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        aria-label="Game mode selection"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 mb-5"
      >
        {/* Mode 1: Create a LAN game */}
        <button
          type="button"
          role="tab"
          id="tab-create"
          ref={(el) => { tabRefs.current.create = el; }}
          tabIndex={selectedMode === 'create' ? 0 : -1}
          aria-selected={selectedMode === 'create'}
          aria-controls="panel-create"
          onClick={() => handleSelectMode('create')}
          onKeyDown={(e) => handleTabKeyDown(e, 'create')}
          className={`flex flex-col text-left rounded-xl border p-3.5 transition-all focus-visible:outline-none ${
            selectedMode === 'create'
              ? 'border-amber-400 bg-amber-400/10 shadow-sm text-white'
              : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                selectedMode === 'create'
                  ? 'border-amber-400/40 bg-amber-400/20 text-amber-300'
                  : 'border-slate-700/60 bg-slate-800/80 text-slate-300'
              }`}
            >
              <IconBroadcast className="h-4 w-4" />
            </span>
            {selectedMode === 'create' && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            )}
          </div>
          <span className="mt-2 text-sm font-bold text-white">Create a LAN game</span>
          <span className="mt-0.5 text-xs text-slate-400">Host a match on your network</span>
        </button>

        {/* Mode 2: Join a LAN game */}
        <button
          type="button"
          role="tab"
          id="tab-join"
          ref={(el) => { tabRefs.current.join = el; }}
          tabIndex={selectedMode === 'join' ? 0 : -1}
          aria-selected={selectedMode === 'join'}
          aria-controls="panel-join"
          onClick={() => handleSelectMode('join')}
          onKeyDown={(e) => handleTabKeyDown(e, 'join')}
          className={`flex flex-col text-left rounded-xl border p-3.5 transition-all focus-visible:outline-none ${
            selectedMode === 'join'
              ? 'border-amber-400 bg-amber-400/10 shadow-sm text-white'
              : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                selectedMode === 'join'
                  ? 'border-amber-400/40 bg-amber-400/20 text-amber-300'
                  : 'border-slate-700/60 bg-slate-800/80 text-slate-300'
              }`}
            >
              <IconLink className="h-4 w-4" />
            </span>
            {selectedMode === 'join' && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            )}
          </div>
          <span className="mt-2 text-sm font-bold text-white">Join a LAN game</span>
          <span className="mt-0.5 text-xs text-slate-400">Connect to a host's room code</span>
        </button>

        {/* Mode 3: Play computer */}
        <button
          type="button"
          role="tab"
          id="tab-computer"
          ref={(el) => { tabRefs.current.computer = el; }}
          tabIndex={selectedMode === 'computer' ? 0 : -1}
          aria-selected={selectedMode === 'computer'}
          aria-controls="panel-computer"
          onClick={() => handleSelectMode('computer')}
          onKeyDown={(e) => handleTabKeyDown(e, 'computer')}
          className={`flex flex-col text-left rounded-xl border p-3.5 transition-all focus-visible:outline-none ${
            selectedMode === 'computer'
              ? 'border-amber-400 bg-amber-400/10 shadow-sm text-white'
              : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                selectedMode === 'computer'
                  ? 'border-amber-400/40 bg-amber-400/20 text-amber-300'
                  : 'border-slate-700/60 bg-slate-800/80 text-slate-300'
              }`}
            >
              <IconCpu className="h-4 w-4" />
            </span>
            {selectedMode === 'computer' && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            )}
          </div>
          <span className="mt-2 text-sm font-bold text-white">Play computer</span>
          <span className="mt-0.5 text-xs text-slate-400">Offline practice with Stockfish</span>
        </button>
      </div>

      {/* Setup Panels: All panels stay mounted so aria-controls remains valid and form state is preserved */}
      <div className="panel border-slate-800/80 bg-slate-900/80 shadow-md">
        {/* PANEL 1: Create a LAN game */}
        <div
          id="panel-create"
          role="tabpanel"
          aria-labelledby="tab-create"
          tabIndex={0}
          hidden={selectedMode !== 'create'}
          className={`space-y-5 focus:outline-none ${selectedMode !== 'create' ? 'hidden' : ''}`}
        >
            <div>
              <h2 className="text-base font-bold text-white">Create LAN Match</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose a time control to host a room for another device on this network.
              </p>
            </div>

            {/* Time Control Options */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Time Control
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllTimeControls(!showAllTimeControls)}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {showAllTimeControls ? 'Show common presets' : 'Show all presets'}
                </button>
              </div>

              {/* Recent Time Controls if available */}
              {recentTimeControls.length > 0 && !showAllTimeControls && (
                <div className="mt-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Recent
                  </span>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {recentTimeControls.map((tc) => (
                      <TimeControlButton
                        key={`recent-${tc}`}
                        value={tc}
                        label={formatTimeControl(tc)}
                        selected={timeControl === tc}
                        onSelect={onTimeControlChange}
                        disabled={isConnecting}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Common Time Controls (Default View) */}
              {!showAllTimeControls && (
                <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {COMMON_TIME_CONTROLS.map((tc) => (
                    <TimeControlButton
                      key={tc}
                      value={tc}
                      label={formatTimeControl(tc)}
                      selected={timeControl === tc}
                      onSelect={onTimeControlChange}
                      disabled={isConnecting}
                    />
                  ))}
                </div>
              )}

              {/* Full Time Control Groups (Expanded View) */}
              {showAllTimeControls && (
                <div className="mt-3 space-y-3">
                  {TIME_CONTROL_GROUPS.map((group) => (
                    <div key={group.category}>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {group.icon} {group.category}
                      </span>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {group.controls.map((tc) => (
                          <TimeControlButton
                            key={tc}
                            value={tc}
                            label={formatTimeControl(tc)}
                            selected={timeControl === tc}
                            onSelect={onTimeControlChange}
                            disabled={isConnecting}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Accessible "More options" disclosure */}
            <details className="border-t border-slate-800/80 pt-3 group">
              <summary className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-between select-none">
                <span>More options</span>
                <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-3 pl-1">
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Allow Casual Takebacks
                    </span>
                    <p className="text-xs text-slate-400">
                      Opponents can request to take back accidental blunders
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowTakebacks}
                    onChange={(e) => onAllowTakebacksChange(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-400 cursor-pointer"
                  />
                </label>
              </div>
            </details>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={onCreateGame}
              disabled={isConnecting || !trimmedName}
              className="action-button action-primary w-full text-sm font-bold flex items-center justify-center gap-2"
            >
              <span>Create Game</span>
            </button>
        </div>

        {/* PANEL 2: Join a LAN game */}
        <div
          id="panel-join"
          role="tabpanel"
          aria-labelledby="tab-join"
          tabIndex={0}
          hidden={selectedMode !== 'join'}
          className={`space-y-5 focus:outline-none ${selectedMode !== 'join' ? 'hidden' : ''}`}
        >
            <div>
              <h2 className="text-base font-bold text-white">Join LAN Match</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Connect to a game hosted on your local network.
              </p>
            </div>

            {/* Guidance on LAN connection */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-amber-300/90">How to connect:</p>
              <p className="mt-1 text-slate-400 leading-relaxed">
                Make sure your device is connected to the same local Wi-Fi or Ethernet network as the host. First open the host’s shared LAN address in your browser, then enter the room code below.
              </p>
            </div>

            {/* Room code input */}
            <div>
              <label
                htmlFor="room-code-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-400"
              >
                Room Code
              </label>
              <input
                id="room-code-input"
                type="text"
                className="field code-field mt-1.5 text-center text-xl font-bold tracking-widest uppercase"
                placeholder="CODE"
                value={roomCode}
                onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
                maxLength={5}
                disabled={isConnecting}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5 sm:flex-row pt-1">
              <button
                type="button"
                onClick={onJoinGame}
                disabled={isConnecting || !trimmedName || !trimmedCode}
                className="action-button action-primary flex-1 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>Join Game</span>
              </button>
              <button
                type="button"
                onClick={onJoinSpectator}
                disabled={isConnecting || !trimmedCode}
                className="action-button action-secondary flex-1 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <span>Watch Game</span>
              </button>
            </div>
        </div>

        {/* PANEL 3: Play computer */}
        <div
          id="panel-computer"
          role="tabpanel"
          aria-labelledby="tab-computer"
          tabIndex={0}
          hidden={selectedMode !== 'computer'}
          className={`space-y-5 focus:outline-none ${selectedMode !== 'computer' ? 'hidden' : ''}`}
        >
            <div>
              <h2 className="text-base font-bold text-white">Play vs Computer</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Play an offline game against the Stockfish chess engine.
              </p>
            </div>

            {/* Side Selection */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Your Side
              </span>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setComputerColor('w')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2 text-xs font-semibold transition-all ${
                    computerColor === 'w'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-sm'
                      : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="inline-block h-3 w-3 rounded-full border border-slate-300 bg-white" aria-hidden="true" />
                  <span>White</span>
                </button>

                <button
                  type="button"
                  onClick={() => setComputerColor('random')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2 text-xs font-semibold transition-all ${
                    computerColor === 'random'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-sm'
                      : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <IconDice className="h-3.5 w-3.5 text-amber-300" />
                  <span>Random</span>
                </button>

                <button
                  type="button"
                  onClick={() => setComputerColor('b')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2 text-xs font-semibold transition-all ${
                    computerColor === 'b'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-sm'
                      : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="inline-block h-3 w-3 rounded-full border border-slate-600 bg-slate-950" aria-hidden="true" />
                  <span>Black</span>
                </button>
              </div>
            </div>

            {/* Difficulty Selection with Human-Readable Labels */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Difficulty
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(['beginner', 'easy', 'medium', 'hard', 'expert'] as ComputerDifficulty[]).map((d) => {
                  const label = DIFFICULTY_LABELS[d];
                  const selected = computerDifficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setComputerDifficulty(d)}
                      className={`rounded-lg border p-2.5 text-left transition-all ${
                        selected
                          ? 'border-amber-400 bg-amber-400/10 text-white shadow-sm'
                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{label.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-snug">{label.subtitle}</div>
                    </button>
                  );
                })}
              </div>

              {/* Optional Technical Details Disclosure */}
              <details className="mt-2 group">
                <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-300 flex items-center gap-1 select-none">
                  <span>Engine parameters</span>
                  <span className="text-[10px] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Search Depth:</span>
                    <span className="font-mono text-slate-300">{DIFFICULTY_CONFIGS[computerDifficulty].depth} ply</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Engine Skill Level:</span>
                    <span className="font-mono text-slate-300">{DIFFICULTY_CONFIGS[computerDifficulty].skillLevel} / 20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Move Calculation Time:</span>
                    <span className="font-mono text-slate-300">{DIFFICULTY_CONFIGS[computerDifficulty].moveTimeMs} ms</span>
                  </div>
                </div>
              </details>
            </div>

            {/* Time Control Selection */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Time Control
              </span>
              <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(['unlimited', '1+0', '3+2', '5+0', '10+0', '15+10'] as TimeControl[]).map((tc) => (
                  <button
                    key={tc}
                    type="button"
                    onClick={() => setComputerTimeControl(tc)}
                    className={`rounded-lg border p-2 text-center text-xs font-semibold transition-all ${
                      computerTimeControl === tc
                        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300 font-bold shadow-sm'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {formatTimeControl(tc)}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() =>
                onStartComputerGame({
                  playerName: trimmedName || 'Player',
                  colorChoice: computerColor,
                  difficulty: computerDifficulty,
                  timeControl: computerTimeControl,
                })
              }
              className="action-button action-primary w-full text-sm font-bold flex items-center justify-center gap-2"
            >
              <span>Start Match vs Computer</span>
            </button>
        </div>
      </div>
    </main>
  );
};

interface TimeControlButtonProps {
  value: TimeControl;
  label: string;
  selected: boolean;
  onSelect: (tc: TimeControl) => void;
  disabled?: boolean;
}

const TimeControlButton: React.FC<TimeControlButtonProps> = ({
  value,
  label,
  selected,
  onSelect,
  disabled,
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={() => onSelect(value)}
    disabled={disabled}
    className={`rounded-lg border p-2 text-center text-xs font-semibold transition-all ${
      selected
        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300 font-bold shadow-sm'
        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
    } disabled:opacity-50`}
  >
    {label}
  </button>
);
