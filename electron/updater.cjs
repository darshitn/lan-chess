/**
 * LAN Chess — Desktop In-App Updater Module (electron-updater).
 *
 * Runs exclusively in Electron's main process.
 * Manages update checks, download progress, and user-initiated restarts.
 * Strictly prevents restarts or installer execution while an active chess game is in progress.
 */

const { app, ipcMain } = require('electron');

let autoUpdaterInstance = null;
function getAutoUpdater() {
  if (!autoUpdaterInstance) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdaterInstance = autoUpdater;
    } catch (err) {
      // In non-electron testing environments, autoUpdater may fail to instantiate
      autoUpdaterInstance = null;
    }
  }
  return autoUpdaterInstance;
}

function createInitialStatus() {
  return {
    status: 'idle',
    info: null,
    progress: null,
    error: null,
    checkedAt: null,
  };
}

function sanitizeErrorMessage(err) {
  if (!err) return 'Unknown update error occurred.';
  const msg = typeof err === 'string' ? err : err.message || String(err);
  if (
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ERR_INTERNET_DISCONNECTED') ||
    msg.includes('net::ERR_NAME_NOT_RESOLVED')
  ) {
    return 'Unable to reach the update server. Please verify your internet connection.';
  }
  if (msg.includes('404')) {
    return 'Update release not found on update server.';
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return 'Connection to update server timed out. Please try again.';
  }
  // Strip full local file paths if present
  const cleaned = msg.replace(/[a-zA-Z]:\\[^:\n]+/g, '[path]').replace(/\/Users\/[^\s]+/g, '[path]');
  return cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned;
}

function canQuitAndInstall(isGameActive, currentStatus) {
  if (isGameActive) {
    return {
      allowed: false,
      reason: 'Cannot restart while a chess game is active. Please finish or leave the game first.',
    };
  }
  if (!currentStatus || currentStatus.status !== 'downloaded') {
    return {
      allowed: false,
      reason: 'No update is ready to install.',
    };
  }
  return { allowed: true };
}

class DesktopUpdater {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.isGameActive = false;
    this.status = createInitialStatus();
    this.mockUpdater = options.mockUpdater || null;
    this.updater = this.mockUpdater || getAutoUpdater();
    this.isDev = options.isDev !== undefined ? options.isDev : (!app.isPackaged || process.env.LANCHESS_DEV === '1');
    this.logger = options.logger || console;
    this.initialized = false;
  }

  broadcastStatus() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('desktop:updater-status-changed', { ...this.status });
      } catch {
        // window closed or navigating
      }
    }
  }

  setGameActive(active) {
    this.isGameActive = Boolean(active);
  }

  getStatus() {
    return { ...this.status };
  }

  async checkForUpdates() {
    this.status.status = 'checking';
    this.status.error = null;
    this.broadcastStatus();

    // Dev environment guard unless mock updater is provided
    if (this.isDev && !this.mockUpdater && process.env.LANCHESS_TEST_UPDATER !== '1') {
      this.status.status = 'idle';
      this.status.checkedAt = Date.now();
      this.status.error = 'In-app updates are only active in installed desktop builds.';
      this.broadcastStatus();
      return {
        success: false,
        status: 'error',
        error: this.status.error,
      };
    }

    if (!this.updater) {
      this.status.status = 'error';
      this.status.error = 'Auto-updater library is not available.';
      this.broadcastStatus();
      return { success: false, status: 'error', error: this.status.error };
    }

    try {
      const result = await this.updater.checkForUpdates();
      return {
        success: true,
        status: this.status.status,
        info: this.status.info,
      };
    } catch (err) {
      const sanitized = sanitizeErrorMessage(err);
      this.status.status = 'error';
      this.status.error = sanitized;
      this.status.checkedAt = Date.now();
      this.broadcastStatus();
      return {
        success: false,
        status: 'error',
        error: sanitized,
      };
    }
  }

  quitAndInstall() {
    const check = canQuitAndInstall(this.isGameActive, this.status);
    if (!check.allowed) {
      return { success: false, message: check.reason };
    }

    try {
      if (this.updater && typeof this.updater.quitAndInstall === 'function') {
        // isSilent = false (shows progress), isForceRunAfter = true (relaunches app)
        setImmediate(() => {
          this.updater.quitAndInstall(false, true);
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: sanitizeErrorMessage(err) };
    }
  }

  registerIpc() {
    ipcMain.handle('desktop:updater-get-status', () => {
      return this.getStatus();
    });

    ipcMain.handle('desktop:updater-check', async () => {
      return await this.checkForUpdates();
    });

    ipcMain.handle('desktop:updater-quit-and-install', () => {
      return this.quitAndInstall();
    });

    ipcMain.on('desktop:updater-set-game-active', (_event, active) => {
      this.setGameActive(active);
    });
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.registerIpc();

    if (!this.updater) return;

    try {
      this.updater.autoDownload = true;
      this.updater.autoInstallOnAppQuit = false;

      this.updater.on('checking-for-update', () => {
        this.status.status = 'checking';
        this.status.error = null;
        this.broadcastStatus();
      });

      this.updater.on('update-available', (info) => {
        this.status.status = 'available';
        this.status.info = {
          version: info?.version || 'unknown',
          releaseDate: info?.releaseDate,
        };
        this.status.error = null;
        this.broadcastStatus();
      });

      this.updater.on('update-not-available', (info) => {
        this.status.status = 'not-available';
        this.status.info = info?.version ? { version: info.version } : null;
        this.status.checkedAt = Date.now();
        this.status.error = null;
        this.broadcastStatus();
      });

      this.updater.on('download-progress', (progressObj) => {
        this.status.status = 'downloading';
        this.status.progress = {
          percent: Math.round(progressObj.percent || 0),
          bytesPerSecond: Math.round(progressObj.bytesPerSecond || 0),
          transferred: progressObj.transferred || 0,
          total: progressObj.total || 0,
        };
        this.broadcastStatus();
      });

      this.updater.on('update-downloaded', (info) => {
        this.status.status = 'downloaded';
        this.status.progress = null;
        this.status.info = {
          version: info?.version || this.status.info?.version || 'unknown',
          releaseDate: info?.releaseDate || this.status.info?.releaseDate,
        };
        this.status.checkedAt = Date.now();
        this.status.error = null;
        this.broadcastStatus();
      });

      this.updater.on('error', (err) => {
        this.status.status = 'error';
        this.status.error = sanitizeErrorMessage(err);
        this.status.checkedAt = Date.now();
        this.broadcastStatus();
      });

      // Background check at launch (packaged only, delayed 4s to allow initial UI mount)
      if (!this.isDev || process.env.LANCHESS_TEST_UPDATER === '1') {
        setTimeout(() => {
          this.checkForUpdates().catch(() => {});
        }, 4000);
      }
    } catch (e) {
      this.logger.error?.('Failed to setup autoUpdater listeners:', e);
    }
  }
}

module.exports = {
  createInitialStatus,
  sanitizeErrorMessage,
  canQuitAndInstall,
  DesktopUpdater,
};
