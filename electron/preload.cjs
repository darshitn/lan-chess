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
});
