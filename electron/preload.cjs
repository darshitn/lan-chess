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
});
