import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDesktopApp,
  getDesktopUpdateStatus,
  checkForDesktopUpdates,
  quitAndInstallDesktopUpdate,
  setDesktopGameActive,
  subscribeToUpdateStatus,
  formatBytes,
  formatSpeed,
} from './desktop-updater.js';

describe('desktop-updater service', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  function setWindow(val: unknown) {
    Object.defineProperty(globalThis, 'window', {
      value: val,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      // @ts-expect-error cleanup
      delete globalThis.window;
    }
  });

  describe('web environment fallback', () => {
    beforeEach(() => {
      setWindow({});
    });

    it('detects non-desktop environment', () => {
      expect(isDesktopApp()).toBe(false);
    });

    it('returns idle status in web', async () => {
      const status = await getDesktopUpdateStatus();
      expect(status.status).toBe('idle');
      expect(status.error).toBeNull();
    });

    it('returns safe error on check in web', async () => {
      const res = await checkForDesktopUpdates();
      expect(res.success).toBe(false);
      expect(res.error).toContain('only available in the desktop application');
    });

    it('returns safe error on quitAndInstall in web', async () => {
      const res = await quitAndInstallDesktopUpdate();
      expect(res.success).toBe(false);
      expect(res.message).toContain('only available in the desktop application');
    });

    it('handles setGameActive and subscribe without errors', () => {
      expect(() => setDesktopGameActive(true)).not.toThrow();
      const unsub = subscribeToUpdateStatus(() => {});
      expect(typeof unsub).toBe('function');
      expect(() => unsub()).not.toThrow();
    });
  });

  describe('desktop environment', () => {
    it('detects desktop environment when bridge is present', () => {
      setWindow({
        desktop: {
          platform: 'win32',
          getStatus: vi.fn(),
          getUpdateStatus: vi.fn(),
        },
      });

      expect(isDesktopApp()).toBe(true);
    });

    it('proxies getDesktopUpdateStatus to bridge', async () => {
      const mockStatus = {
        status: 'available' as const,
        info: { version: '1.2.1' },
        progress: null,
        error: null,
        checkedAt: 123456,
      };
      setWindow({
        desktop: {
          platform: 'win32',
          getStatus: vi.fn(),
          getUpdateStatus: vi.fn().mockResolvedValue(mockStatus),
        },
      });

      const result = await getDesktopUpdateStatus();
      expect(result).toEqual(mockStatus);
    });

    it('proxies checkForDesktopUpdates and handles exceptions', async () => {
      setWindow({
        desktop: {
          platform: 'win32',
          getStatus: vi.fn(),
          getUpdateStatus: vi.fn(),
          checkForUpdates: vi.fn().mockRejectedValue(new Error('Network failure')),
        },
      });

      const res = await checkForDesktopUpdates();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Network failure');
    });

    it('proxies quitAndInstallDesktopUpdate and setDesktopGameActive', async () => {
      const quitMock = vi.fn().mockResolvedValue({ success: true });
      const activeMock = vi.fn();

      setWindow({
        desktop: {
          platform: 'win32',
          getStatus: vi.fn(),
          getUpdateStatus: vi.fn(),
          quitAndInstall: quitMock,
          setGameActive: activeMock,
        },
      });

      const res = await quitAndInstallDesktopUpdate();
      expect(res.success).toBe(true);
      expect(quitMock).toHaveBeenCalled();

      setDesktopGameActive(true);
      expect(activeMock).toHaveBeenCalledWith(true);
    });

    it('subscribes and returns unsubscribe callback', () => {
      const unsubMock = vi.fn();
      const onUpdateMock = vi.fn().mockReturnValue(unsubMock);

      setWindow({
        desktop: {
          platform: 'win32',
          getStatus: vi.fn(),
          getUpdateStatus: vi.fn(),
          onUpdateStatus: onUpdateMock,
        },
      });

      const listener = vi.fn();
      const unsub = subscribeToUpdateStatus(listener);
      expect(onUpdateMock).toHaveBeenCalledWith(listener);

      unsub();
      expect(unsubMock).toHaveBeenCalled();
    });
  });

  describe('formatting helpers', () => {
    it('formats byte quantities accurately', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(10485760)).toBe('10 MB');
      expect(formatBytes(12582912)).toBe('12 MB');
      expect(formatBytes(-1)).toBe('0 B');
    });

    it('formats network speed values', () => {
      expect(formatSpeed(0)).toBe('0 B/s');
      expect(formatSpeed(2048)).toBe('2 KB/s');
      expect(formatSpeed(1572864)).toBe('1.5 MB/s');
    });
  });
});
