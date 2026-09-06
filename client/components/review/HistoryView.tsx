import React, { useState } from 'react';
import type { SavedGame } from '../../services/game-history.js';
import { computePlayerStats } from '../../services/statistics.js';

interface HistoryViewProps {
  games: SavedGame[];
  playerName: string;
  onSelectGame: (game: SavedGame) => void;
  onDeleteGame: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onBackToPlay: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  games,
  playerName,
  onSelectGame,
  onDeleteGame,
  onToggleFavorite,
  onBackToPlay,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const stats = computePlayerStats(games, playerName);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-3 py-6 sm:px-6">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Personal Archives</p>
          <h1 className="text-2xl font-black text-white sm:text-3xl">Game History & Stats</h1>
        </div>
        <button
          type="button"
          onClick={onBackToPlay}
          className="action-button action-primary text-xs font-bold"
        >
          ♟ Play LAN Match
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'history' ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
        >
          📜 Match History ({games.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'stats' ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
        >
          📊 Player Statistics
        </button>
      </div>

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {games.length === 0 ? (
            <div className="panel text-center py-12">
              <p className="text-base font-semibold text-slate-300">No games saved yet.</p>
              <p className="mt-1 text-xs text-slate-500">Completed LAN matches are automatically saved here for review.</p>
            </div>
          ) : (
            games.map((g) => {
              const dateStr = new Date(g.date).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={g.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(g.id)}
                        className={`text-sm ${g.isFavorite ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                        title="Toggle Favorite"
                      >
                        ★
                      </button>
                      <span className="font-bold text-white text-sm">
                        {g.whiteName} vs {g.blackName}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                        {g.timeControl}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{Math.ceil(g.moves.length / 2)} moves</span>
                      <span>•</span>
                      <span className="font-semibold text-amber-300">
                        {g.winner === 'draw' ? 'Draw' : g.winner === 'w' ? 'White won' : 'Black won'}
                      </span>
                      {g.opening && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 italic">{g.opening.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onSelectGame(g)}
                      className="action-button action-primary px-3 py-1.5 text-xs font-bold"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGame(g.id)}
                      className="rounded p-1.5 text-slate-500 hover:text-rose-400"
                      title="Delete Game"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* STATISTICS TAB */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="panel text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Games Played</span>
              <p className="text-2xl font-black text-white mt-1">{stats.gamesPlayed}</p>
            </div>
            <div className="panel text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Win Rate</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">{stats.winRate}%</p>
            </div>
            <div className="panel text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Wins / Losses</span>
              <p className="text-xl font-black text-white mt-1">
                <span className="text-emerald-400">{stats.wins}</span> / <span className="text-rose-400">{stats.losses}</span>
                {stats.draws > 0 && <span className="text-xs text-slate-400"> ({stats.draws}D)</span>}
              </p>
            </div>
            <div className="panel text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Avg Game Length</span>
              <p className="text-2xl font-black text-white mt-1">{stats.avgGameLength} moves</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Preferences & Habits</span>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Favorite Opening</span>
                <span className="font-bold text-white">{stats.favoriteOpening}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Most Played Color</span>
                <span className="font-bold text-white">{stats.mostPlayedColor}</span>
              </div>
            </div>

            <div className="panel space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Performance Records</span>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Fastest Victory</span>
                <span className="font-bold text-emerald-400">{stats.fastestWin ? `${stats.fastestWin} moves` : '—'}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Longest Match</span>
                <span className="font-bold text-white">{stats.longestGame > 0 ? `${stats.longestGame} moves` : '—'}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Total Pieces Captured</span>
                <span className="font-bold text-amber-300">{stats.totalCaptures}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
