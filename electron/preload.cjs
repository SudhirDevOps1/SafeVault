/**
 * SafeVault Preload Script
 * 
 * Exposes a MINIMAL, WHITELISTED API to renderer via contextBridge.
 * No direct access to Node.js APIs from renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = [
  'safevault:lock',
  'safevault:unlock',
];

// Expose protected API
contextBridge.exposeInMainWorld('safevault', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('safevault:get-app-version'),
  getAppPath: (type) => ipcRenderer.invoke('safevault:get-app-path', type),

  // Dialog
  showSaveDialog: (options) => ipcRenderer.invoke('safevault:show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('safevault:show-open-dialog', options),

  // Clipboard
  clearClipboard: () => ipcRenderer.invoke('safevault:clear-clipboard'),

  // Event listeners (from main process)
  onLockRequest: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('safevault:lock', handler);
    return () => ipcRenderer.removeListener('safevault:lock', handler);
  },

  // Platform info
  platform: process.platform,
  isElectron: true,
});

// Prevent contextBridge from being tampered with
Object.freeze(contextBridge);
