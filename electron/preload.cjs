/**
 * LAN Chess — Electron preload.
 *
 * Exposes the minimal read-only desktop bridge to the renderer.
 * No filesystem, shell, or arbitrary process access is exposed.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  copyText: (text) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > 5000) {
      return Promise.resolve(false);
    }
    return ipcRenderer.invoke('desktop:copy-text', text);
  },
  // In-app updater bridge
  getUpdateStatus: () => ipcRenderer.invoke('desktop:updater-get-status'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:updater-check'),
  quitAndInstall: () => ipcRenderer.invoke('desktop:updater-quit-and-install'),
  setGameActive: (active) => {
    ipcRenderer.send('desktop:updater-set-game-active', Boolean(active));
  },
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('desktop:updater-status-changed', listener);
    return () => {
      ipcRenderer.removeListener('desktop:updater-status-changed', listener);
    };
  },
});
