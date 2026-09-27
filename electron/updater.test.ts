import { describe, it, expect, vi } from 'vitest';
import {
  createInitialStatus,
  sanitizeErrorMessage,
  canQuitAndInstall,
  DesktopUpdater,
} from './updater.cjs';

describe('DesktopUpdater Utilities', () => {
  describe('createInitialStatus()', () => {
    it('returns idle status with null fields', () => {
      const status = createInitialStatus();
      expect(status.status).toBe('idle');
      expect(status.info).toBeNull();
      expect(status.progress).toBeNull();
      expect(status.error).toBeNull();
      expect(status.checkedAt).toBeNull();
    });
  });

  describe('sanitizeErrorMessage()', () => {
    it('provides user-friendly explanation for offline / connection failure', () => {
      expect(sanitizeErrorMessage('Error: getaddrinfo ENOTFOUND github.com')).toContain(
        'Unable to reach the update server'
      );
      expect(sanitizeErrorMessage(new Error('net::ERR_INTERNET_DISCONNECTED'))).toContain(
        'Unable to reach the update server'
      );
      expect(sanitizeErrorMessage('connect ECONNREFUSED 127.0.0.1:443')).toContain(
        'Unable to reach the update server'
      );
    });

    it('provides explanation for missing release 404', () => {
      expect(sanitizeErrorMessage('HttpError: 404 Not Found')).toContain('Update release not found');
    });

    it('sanitizes local file paths out of error strings', () => {
      const raw = 'Error loading C:\\Users\\Admin\\AppData\\Local\\Temp\\update.exe: failed';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('C:\\Users\\Admin\\AppData');
      expect(sanitized).toContain('[path]');
    });

    it('handles null / empty errors safely', () => {
      expect(sanitizeErrorMessage(null)).toBe('Unknown update error occurred.');
    });
  });

  describe('canQuitAndInstall()', () => {
    it('refuses restart when game is active even if update is downloaded', () => {
      const activeCheck = canQuitAndInstall(true, { status: 'downloaded' });
      expect(activeCheck.allowed).toBe(false);
      expect(activeCheck.reason).toContain('Cannot restart while a chess game is active');
    });

    it('refuses restart when no update is downloaded', () => {
      const idleCheck = canQuitAndInstall(false, { status: 'idle' });
      expect(idleCheck.allowed).toBe(false);
      expect(idleCheck.reason).toContain('No update is ready to install');

      const downloadingCheck = canQuitAndInstall(false, { status: 'downloading' });
      expect(downloadingCheck.allowed).toBe(false);
    });

    it('allows restart when game is inactive and update is downloaded', () => {
      const readyCheck = canQuitAndInstall(false, { status: 'downloaded' });
      expect(readyCheck.allowed).toBe(true);
      expect(readyCheck.reason).toBeUndefined();
    });
  });

  describe('DesktopUpdater class state management', () => {
    function createMockWindow() {
      const sentEvents: Array<{ channel: string; data: any }> = [];
      return {
        isDestroyed: () => false,
        webContents: {
          send: (channel: string, data: any) => {
            sentEvents.push({ channel, data });
          },
        },
        sentEvents,
      };
    }

    it('tracks game active state and blocks quitAndInstall', () => {
      const mockWin = createMockWindow();
      const mockUpdater = {
        quitAndInstall: vi.fn(),
        on: vi.fn(),
        checkForUpdates: vi.fn(),
      };

      const updater = new DesktopUpdater(mockWin as any, {
        mockUpdater,
        isDev: false,
      });

      // Default inactive, but not downloaded
      expect(updater.quitAndInstall().success).toBe(false);

      // Simulate downloaded state
      updater.status.status = 'downloaded';

      // Set game active
      updater.setGameActive(true);
      const activeResult = updater.quitAndInstall();
      expect(activeResult.success).toBe(false);
      expect(activeResult.message).toContain('Cannot restart while a chess game is active');
      expect(mockUpdater.quitAndInstall).not.toHaveBeenCalled();

      // Deactivate game
      updater.setGameActive(false);
      const readyResult = updater.quitAndInstall();
      expect(readyResult.success).toBe(true);
    });

    it('broadcasts status changes to window', () => {
      const mockWin = createMockWindow();
      const mockUpdater = {
        quitAndInstall: vi.fn(),
        on: vi.fn(),
        checkForUpdates: vi.fn(),
      };

      const updater = new DesktopUpdater(mockWin as any, {
        mockUpdater,
        isDev: false,
      });

      updater.status.status = 'checking';
      updater.broadcastStatus();

      expect(mockWin.sentEvents.length).toBe(1);
      expect(mockWin.sentEvents[0].channel).toBe('desktop:updater-status-changed');
      expect(mockWin.sentEvents[0].data.status).toBe('checking');
    });

    it('guards against update checks in dev mode unless test flag is set', async () => {
      const mockWin = createMockWindow();
      const updater = new DesktopUpdater(mockWin as any, {
        mockUpdater: null,
        isDev: true,
      });

      const res = await updater.checkForUpdates();
      expect(res.success).toBe(false);
      expect(res.error).toContain('only active in installed desktop builds');
    });
  });
});
