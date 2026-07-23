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

  // Sync Server
  startSyncServer: (vaultData) => ipcRenderer.invoke('safevault:start-sync-server', vaultData),
  stopSyncServer: () => ipcRenderer.invoke('safevault:stop-sync-server'),
  onSyncRequest: (callback) => {
    const handler = (event, clientVault, responseCallbackId) => {
      // Allow React app to merge and return data
      callback(clientVault, (err, mergedVault) => {
        ipcRenderer.send(`safevault:sync-merged-response:${responseCallbackId}`, err, mergedVault);
      });
    };
    ipcRenderer.on('safevault:sync-request', handler);
    return () => ipcRenderer.removeListener('safevault:sync-request', handler);
  },

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
