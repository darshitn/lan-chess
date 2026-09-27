import React, { useState, useEffect } from 'react';
import type { UpdateStatusPayload } from '../../shared/types.js';
import {
  isDesktopApp,
  getDesktopUpdateStatus,
  subscribeToUpdateStatus,
  quitAndInstallDesktopUpdate,
  formatBytes,
} from '../services/desktop-updater.js';

interface UpdateBannerProps {
  isGameActive: boolean;
  onOpenSettings?: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ isGameActive, onOpenSettings }) => {
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopApp()) return;

    void getDesktopUpdateStatus().then(setStatus);
    const unsubscribe = subscribeToUpdateStatus((newStatus) => {
      setStatus(newStatus);
      // If a new update is downloaded, re-show banner even if previously dismissed
      if (newStatus.status === 'downloaded') {
        setDismissed(false);
      }
    });

    return unsubscribe;
  }, []);

  if (!status || dismissed) return null;

  // Only show banner for interesting states: available, downloading, downloaded
  if (
    status.status !== 'downloaded' &&
    status.status !== 'downloading' &&
    status.status !== 'available'
  ) {
    return null;
  }

  const handleRestart = async () => {
    if (isGameActive) {
      setInstallError('Cannot restart while a chess game is active.');
      return;
    }
    setInstallError(null);
    const res = await quitAndInstallDesktopUpdate();
    if (!res.success && res.message) {
      setInstallError(res.message);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-xl border border-sky-500/50 bg-sky-950/40 p-3 text-xs text-sky-200 shadow-lg backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
          </span>

          <div>
            {status.status === 'downloaded' && (
              <p className="font-bold text-white">
                Update ready to install: <span className="text-sky-300">v{status.info?.version}</span>
              </p>
            )}
            {status.status === 'downloading' && (
              <p className="font-semibold text-slate-200">
                Downloading update v{status.info?.version || ''}
                {status.progress ? ` (${status.progress.percent}%)` : '...'}
                {status.progress?.total ? ` • ${formatBytes(status.progress.transferred)} of ${formatBytes(status.progress.total)}` : ''}
              </p>
            )}
            {status.status === 'available' && (
              <p className="font-semibold text-slate-200">
                New version available: <span className="text-sky-300">v{status.info?.version}</span>
              </p>
            )}

            {installError && <p className="mt-0.5 text-[11px] text-rose-300 font-medium">{installError}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status.status === 'downloaded' && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={isGameActive}
              title={isGameActive ? 'Cannot restart during an active game' : 'Restart and install update'}
              className="action-button action-primary px-3 py-1 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGameActive ? 'Game in Progress' : 'Restart to Update'}
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="action-button action-secondary px-2.5 py-1 text-xs"
            >
              View in Settings
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Dismiss update notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
