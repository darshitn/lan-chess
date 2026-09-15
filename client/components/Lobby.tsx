import React, { useState } from 'react';
import type { TimeControl } from '../../shared/types.js';
import { formatTimeControl, TIME_CONTROL_GROUPS } from '../utils/chess-helpers.js';
import {
  type ComputerDifficulty,
  DIFFICULTY_CONFIGS,
} from '../services/computer-player.js';
import type { ComputerGameConfig, PlayerColorChoice } from '../services/computer-game-controller.js';

interface LobbyProps {
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
  onOpenSettings,
  hostUrl,
  error,
  isConnecting,
}) => {
  const [computerColor, setComputerColor] = useState<PlayerColorChoice>('w');
  const [computerDifficulty, setComputerDifficulty] = useState<ComputerDifficulty>('medium');
  const [computerTimeControl, setComputerTimeControl] = useState<TimeControl>('3+2');
  return (
    <main className="mx-auto max-w-xl py-6 sm:py-10">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-between pb-4">
          <span className="text-xs font-bold uppercase tracking-[.35em] text-amber-400">
            LAN Chess V2
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-300"
          >
            <span>⚙️</span>
            <span>Settings & Themes</span>
          </button>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
          LAN CHESS
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Zero setup. Play chess with anyone on your local network.
        </p>
        {hostUrl && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LAN Address:</span>
            <span className="font-mono font-bold text-amber-300">{hostUrl}</span>
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/50 bg-rose-950/70 px-4 py-3 text-sm text-rose-200 shadow-lg">
          <p className="font-semibold">Notice</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Name section */}
        <section className="panel">
          <label htmlFor="player-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Your Display Name
          </label>
          <input
            id="player-name-input"
            type="text"
            className="field mt-2"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={24}
            disabled={isConnecting}
          />
        </section>

        {/* Play vs Computer section */}
        <section className="panel border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h2 className="text-lg font-bold text-white">Play vs Computer</h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Play offline matches against Stockfish with customizable strength and clocks.
              </p>
            </div>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
              100% Offline
            </span>
          </div>

          {/* Color Selection */}
          <div className="mt-4">
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
                <span className="inline-block h-3 w-3 rounded-full border border-slate-300 bg-white" />
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
                <span>🎲</span>
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
                <span className="inline-block h-3 w-3 rounded-full border border-slate-700 bg-slate-950" />
                <span>Black</span>
              </button>
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Difficulty Tier
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(['beginner', 'easy', 'medium', 'hard', 'expert'] as ComputerDifficulty[]).map((d) => {
                const cfg = DIFFICULTY_CONFIGS[d];
                const selected = computerDifficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setComputerDifficulty(d)}
                    className={`rounded-lg border p-2 text-left transition-all ${
                      selected
                        ? 'border-indigo-400 bg-indigo-500/15 text-white shadow-sm'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold">{cfg.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Depth {cfg.depth}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 italic">
              {DIFFICULTY_CONFIGS[computerDifficulty].description}
            </p>
          </div>

          {/* Time Control Selection */}
          <div className="mt-4">
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

          <button
            type="button"
            onClick={() =>
              onStartComputerGame({
                playerName: playerName.trim() || 'Player',
                colorChoice: computerColor,
                difficulty: computerDifficulty,
                timeControl: computerTimeControl,
              })
            }
            className="action-button action-primary mt-4 w-full text-base font-bold bg-indigo-600 hover:bg-indigo-500 border-indigo-400/50 flex items-center justify-center gap-2"
          >
            <span>⚔️</span>
            <span>Start Match vs Computer</span>
          </button>
        </section>

        {/* Create Game section */}
        <section className="panel">
          <h2 className="text-lg">Create New Game</h2>
          <p className="mt-1 text-xs text-slate-400">
            Choose game options and host a new match on your local network.
          </p>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Time Control
            </span>

            {recentTimeControls.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  🕐 Recent
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

            {TIME_CONTROL_GROUPS.map((group) => (
              <div key={group.category} className="mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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

          <div className="mt-4 border-t border-slate-800/80 pt-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-200">Allow Casual Takebacks</span>
                <p className="text-[11px] text-slate-400">Players can request to take back a blunder</p>
              </div>
              <input
                type="checkbox"
                checked={allowTakebacks}
                onChange={(e) => onAllowTakebacksChange(e.target.checked)}
                className="h-4 w-4 rounded accent-amber-400 cursor-pointer"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={onCreateGame}
            disabled={isConnecting || !playerName.trim()}
            className="action-button action-primary mt-4 w-full text-base font-bold"
          >
            Create Room & Play
          </button>
        </section>

        {/* Join Game section */}
        <section className="panel">
          <h2 className="text-lg">Join Existing Game</h2>
          <p className="mt-1 text-xs text-slate-400">
            Enter the 4-character room code shared by the host.
          </p>

          <div className="mt-4">
            <label htmlFor="room-code-input" className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Room Code
            </label>
            <input
              id="room-code-input"
              type="text"
              className="field code-field mt-2 text-center text-xl font-bold tracking-widest"
              placeholder="CODE"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
              maxLength={5}
              disabled={isConnecting}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onJoinGame}
              disabled={isConnecting || !playerName.trim() || !roomCode.trim()}
              className="action-button action-primary flex-1 text-sm font-bold"
            >
              Join as Player (Black)
            </button>
            <button
              type="button"
              onClick={onJoinSpectator}
              disabled={isConnecting || !roomCode.trim()}
              className="action-button action-secondary flex-1 text-sm"
            >
              Watch as Spectator
            </button>
          </div>
        </section>
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

const TimeControlButton: React.FC<TimeControlButtonProps> = ({ value, label, selected, onSelect, disabled }) => (
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
