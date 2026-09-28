import React from 'react';

export type NavView = 'play' | 'puzzles' | 'practice' | 'history';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: NavView) => void;
  onOpenSettings: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onNavigate,
  onOpenSettings,
}) => {
  const isPlayActive = currentView === 'play' || currentView === 'computer';
  const isPuzzlesActive = currentView === 'puzzles';
  const isAnalysisActive = currentView === 'practice';
  const isHistoryActive = currentView === 'history' || currentView === 'review';

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/40">
      <div className="mx-auto max-w-5xl px-3.5 py-2.5 sm:px-6 sm:py-3">
        {/* Mobile top bar: Brand on left, Settings on right */}
        <div className="flex items-center justify-between sm:hidden mb-2">
          <button
            type="button"
            onClick={() => onNavigate('play')}
            className="flex items-center gap-2 text-left focus-visible:outline-none"
            title="LAN Chess Home"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 font-bold text-sm">
              ♟
            </span>
            <span className="text-xs font-extrabold tracking-wide text-white block">
              LAN CHESS
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors flex items-center gap-1.5"
            title="Settings & Themes"
          >
            <span aria-hidden="true">⚙️</span>
            <span>Settings</span>
          </button>
        </div>

        {/* Navigation row: 4-destination grid on mobile, desktop flex row */}
        <div className="flex items-center justify-between">
          {/* Desktop Brand identity (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('play')}
              className="flex items-center gap-2.5 text-left focus-visible:outline-none"
              title="LAN Chess Home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 font-bold text-lg">
                ♟
              </span>
              <div>
                <span className="text-sm font-extrabold tracking-wide text-white block leading-none">
                  LAN CHESS
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium leading-tight">
                  Local &amp; Offline
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation items / Mobile 4-button grid */}
          <nav
            aria-label="Main Navigation"
            className="grid grid-cols-4 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5"
          >
            <button
              type="button"
              onClick={() => onNavigate('play')}
              aria-current={isPlayActive ? 'page' : undefined}
              className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-center transition-colors ${
                isPlayActive
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Play
            </button>

            <button
              type="button"
              onClick={() => onNavigate('puzzles')}
              aria-current={isPuzzlesActive ? 'page' : undefined}
              className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-center transition-colors ${
                isPuzzlesActive
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Puzzles
            </button>

            <button
              type="button"
              onClick={() => onNavigate('practice')}
              aria-current={isAnalysisActive ? 'page' : undefined}
              className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-center transition-colors ${
                isAnalysisActive
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Analysis
            </button>

            <button
              type="button"
              onClick={() => onNavigate('history')}
              aria-current={isHistoryActive ? 'page' : undefined}
              className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-center transition-colors ${
                isHistoryActive
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="sm:inline hidden">Game history</span>
              <span className="sm:hidden inline">History</span>
            </button>

            {/* Desktop Settings button */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="hidden sm:flex rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors items-center gap-1.5"
              title="Settings & Themes"
            >
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
