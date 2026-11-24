import React from 'react';
import './club.css';

export type NavView = 'play' | 'puzzles' | 'practice' | 'history';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: NavView) => void;
  onOpenSettings: () => void;
}

const destinations: ReadonlyArray<[NavView, string]> = [
  ['play', 'Play'], ['puzzles', 'Puzzles'], ['practice', 'Analysis'], ['history', 'History'],
];

export const Navigation: React.FC<NavigationProps> = ({ currentView, onNavigate, onOpenSettings }) => {
  const active = currentView === 'computer' ? 'play' : currentView === 'review' ? 'history' : currentView;

  return (
    <header className="club-header">
      <div className="club-header-inner">
        <button className="club-brand" type="button" onClick={() => onNavigate('play')} title="LAN Chess Home">
          <span className="club-mark" aria-hidden="true" />
          LAN Chess
        </button>
        <nav aria-label="Main Navigation" className="club-nav">
          {destinations.map(([view, label]) => (
            <button key={view} type="button" aria-current={active === view ? 'page' : undefined} onClick={() => onNavigate(view)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="club-settings" type="button" onClick={onOpenSettings} title="Settings & Themes">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12" />
            <circle cx="11" cy="6" r="2" /><circle cx="17" cy="12" r="2" /><circle cx="7" cy="18" r="2" />
          </svg>
          Settings
        </button>
      </div>
    </header>
  );
};
