import React, { useState } from 'react';
import type { SavedGame } from '../../services/game-history.js';
import { computePlayerStats } from '../../services/statistics.js';

import { ConfirmDialog } from '../ConfirmDialog.js';
import '../club.css';

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
  const [pendingDeletion, setPendingDeletion] = useState<SavedGame | null>(null);
  const stats = computePlayerStats(games, playerName);

  return (
    <main className="club-archive">
      <header className="club-page-heading">
        <h1>Game history</h1>
        <button type="button" onClick={onBackToPlay} className="action-button action-secondary">New game</button>
      </header>
      <div className="archive-tabs">
        <button type="button" aria-pressed={activeTab === 'history'} onClick={() => setActiveTab('history')}>Matches <span>{games.length}</span></button>
        <button type="button" aria-pressed={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>Player statistics</button>
      </div>
      {activeTab === 'history' && (games.length === 0 ? (
        <section className="archive-empty">
          <h2>No games saved yet</h2>
          <p>Finish a LAN or computer match to replay it here.</p>
        </section>
      ) : (
        <ul className="archive-list">
          {games.map(game => {
            const date = new Date(game.date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            const result = game.winner === 'draw' ? 'Draw' : game.winner === 'w' ? 'White won' : game.winner === 'b' ? 'Black won' : 'Unfinished';
            return (
              <li key={game.id}>
                <button type="button" className="archive-star" aria-pressed={game.isFavorite} aria-label={`Favorite ${game.whiteName} vs ${game.blackName}`} onClick={() => onToggleFavorite(game.id)}>
                  {game.isFavorite ? '★' : '☆'}
                </button>
                <div className="archive-game">
                  <h2>{game.whiteName} <span>vs</span> {game.blackName}</h2>
                  <p>{[date, game.timeControl, `${Math.ceil(game.moves.length / 2)} moves`, game.opening?.name].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="archive-result">{result}</span>
                <div className="archive-actions">
                  <button type="button" className="action-button action-secondary" onClick={() => onSelectGame(game)}>Review</button>
                  <button type="button" className="archive-delete" aria-label={`Delete game between ${game.whiteName} and ${game.blackName}`} onClick={() => setPendingDeletion(game)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      ))}
      {activeTab === 'stats' && (stats.gamesPlayed ? (
        <section aria-label="Player statistics">
          <dl className="archive-numbers">
            {[
              ['Games played', stats.gamesPlayed], ['Win rate', `${stats.winRate}%`],
              ['Wins / losses / draws', `${stats.wins} / ${stats.losses} / ${stats.draws}`],
              ['Average length', `${stats.avgGameLength} moves`],
            ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <dl className="archive-records">
            {[
              ['Favorite opening', stats.favoriteOpening], ['Most played color', stats.mostPlayedColor],
              ['Fastest victory', stats.fastestWin === null ? '—' : `${stats.fastestWin} moves`],
              ['Longest match', `${stats.longestGame} moves`], ['Total pieces captured', stats.totalCaptures],
            ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
      ) : (
        <section className="archive-empty">
          <h2>No player statistics yet</h2>
          <p>Statistics appear after a game saved under your current player name.</p>
        </section>
      ))}
      {pendingDeletion && (
        <ConfirmDialog title="Delete saved game?" message={`Remove the match between ${pendingDeletion.whiteName} and ${pendingDeletion.blackName} from this device.`}
          confirmLabel="Delete game" danger onCancel={() => setPendingDeletion(null)}
          onConfirm={() => { onDeleteGame(pendingDeletion.id); setPendingDeletion(null); }} />
      )}
    </main>
  );
};
