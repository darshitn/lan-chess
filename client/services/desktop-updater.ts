/**
 * LAN Chess — Desktop In-App Updater Service.
 *
 * Provides a React-friendly interface to Electron's autoUpdater bridge.
 * Degrades safely to a no-op in standard web browser environments.
 */

import type {
  GameState,
  UpdateStatusPayload,
  UpdateCheckResult,
  UpdateInstallResult,
} from '../../shared/types.js';

/**
 * Evaluates whether a multiplayer match is currently in progress, including
 * matches actively being played or temporarily paused during a player's
 * reconnection grace period.
 */
export function isMultiplayerGameActive(gameState: GameState | null): boolean {
  if (!gameState) return false;
  if (gameState.status === 'active') return true;
  // A match paused for an opponent's reconnection has status 'waiting', but both
  // player seats are assigned and no winner/termination has occurred yet.
  if (gameState.status === 'waiting' && gameState.blackName !== null && gameState.winner === null) {
    return true;
  }
  if (gameState.message && gameState.message.toLowerCase().includes('reconnection')) {
    return true;
  }
  return false;
}

export function isDesktopApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.desktop !== 'undefined' &&
    typeof window.desktop.getUpdateStatus === 'function'
  );
}

export async function getDesktopUpdateStatus(): Promise<UpdateStatusPayload> {
  if (isDesktopApp() && window.desktop?.getUpdateStatus) {
    try {
      return await window.desktop.getUpdateStatus();
    } catch {
      // Bridge call failed
    }
  }
  return {
    status: 'idle',
    info: null,
    progress: null,
    error: null,
    checkedAt: null,
  };
}

export async function checkForDesktopUpdates(): Promise<UpdateCheckResult> {
  if (isDesktopApp() && window.desktop?.checkForUpdates) {
    try {
      return await window.desktop.checkForUpdates();
    } catch (err) {
      return {
        success: false,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to invoke update check.',
      };
    }
  }
  return {
    success: false,
    status: 'error',
    error: 'In-app updates are only available in the desktop application.',
  };
}

export async function quitAndInstallDesktopUpdate(): Promise<UpdateInstallResult> {
  if (isDesktopApp() && window.desktop?.quitAndInstall) {
    try {
      return await window.desktop.quitAndInstall();
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to launch updater installer.',
      };
    }
  }
  return {
    success: false,
    message: 'In-app updates are only available in the desktop application.',
  };
}

export function setDesktopGameActive(active: boolean): void {
  if (isDesktopApp() && window.desktop?.setGameActive) {
    try {
      window.desktop.setGameActive(active);
    } catch {
      // Ignored
    }
  }
}

export function subscribeToUpdateStatus(
  callback: (status: UpdateStatusPayload) => void
): () => void {
  if (isDesktopApp() && window.desktop?.onUpdateStatus) {
    try {
      return window.desktop.onUpdateStatus(callback);
    } catch {
      // Ignored
    }
  }
  return () => {};
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  const formatted =
    value >= 10 || i === 0 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}
