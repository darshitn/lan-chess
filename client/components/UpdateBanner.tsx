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
  dismissedKey: string | null;
  onDismiss: (key: string) => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ isGameActive, onOpenSettings, dismissedKey, onDismiss }) => {
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopApp()) return;

    let receivedLiveStatus = false;
    let mounted = true;
    const unsubscribe = subscribeToUpdateStatus((newStatus) => {
      receivedLiveStatus = true;
      setStatus(newStatus);
    });
    void getDesktopUpdateStatus().then((currentStatus) => {
      if (mounted && !receivedLiveStatus) setStatus(currentStatus);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (!status) return null;

  // Only show banner for interesting states: available, downloading, downloaded
  if (
    status.status !== 'downloaded' &&
    status.status !== 'downloading' &&
    status.status !== 'available'
  ) {
    return null;
  }

  // A dismissal lasts for this app launch. A completed download is a new,
  // actionable phase, so it gets one fresh notification even if the earlier
  // downloading notice was dismissed.
  const notificationKey = `${status.info?.version ?? 'unknown'}:${status.status === 'downloaded' ? 'ready' : 'downloading'}`;
  if (dismissedKey === notificationKey) return null;

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
      className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-sky-500/60 bg-slate-950 p-4 text-sm text-sky-200 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
          </span>

          <div className="min-w-0">
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

            <p className="mt-1 text-xs text-slate-300">
              {status.status === 'downloaded'
                ? 'Restart when you are ready. Your current game will not be interrupted.'
                : 'The update is downloading in the background. You can keep playing.'}
            </p>

            {installError && <p className="mt-0.5 text-[11px] text-rose-300 font-medium">{installError}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(notificationKey)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Dismiss update notification"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
            View update
          </button>
        )}
      </div>
    </div>
  );
};
