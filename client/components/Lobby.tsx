import React from 'react';
import type { TimeControl } from '../../shared/types.js';

interface LobbyProps {
  playerName: string;
  onNameChange: (name: string) => void;
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  timeControl: TimeControl;
  onTimeControlChange: (tc: TimeControl) => void;
  allowTakebacks: boolean;
  onAllowTakebacksChange: (allow: boolean) => void;
  onCreateGame: () => void;
  onJoinGame: () => void;
  onJoinSpectator: () => void;
  onOpenSettings: () => void;
  hostUrl: string | null;
  error: string | null;
  isConnecting: boolean;
}

const TIME_CONTROLS: Array<{ value: TimeControl; label: string; desc: string }> = [
  { value: '3+0', label: '3 min', desc: 'Blitz' },
  { value: '5+0', label: '5 min', desc: 'Rapid' },
  { value: '10+0', label: '10 min', desc: 'Standard' },
  { value: '15+10', label: '15 min', desc: 'Classical' },
  { value: 'unlimited', label: 'No Clock', desc: 'Casual' },
];

export const Lobby: React.FC<LobbyProps> = ({
  playerName,
  onNameChange,
  roomCode,
  onRoomCodeChange,
  timeControl,
  onTimeControlChange,
  allowTakebacks,
  onAllowTakebacksChange,
  onCreateGame,
  onJoinGame,
  onJoinSpectator,
  onOpenSettings,
  hostUrl,
  error,
  isConnecting,
}) => {
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
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TIME_CONTROLS.map((tc) => {
                const isSelected = timeControl === tc.value;
                return (
                  <button
                    key={tc.value}
                    type="button"
                    onClick={() => onTimeControlChange(tc.value)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold shadow-sm'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-semibold">{tc.label}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-70">{tc.desc}</span>
                  </button>
                );
              })}
            </div>
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
