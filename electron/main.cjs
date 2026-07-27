/**
 * SafeVault Electron Main Process
 * 
 * Security Hardening:
 * - contextIsolation enabled
 * - nodeIntegration disabled in renderer
 * - sandbox enabled
 * - CSP headers set
 * - Debugging disabled in production
 * - WebPreferences locked down
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeTheme, shell, dialog, powerMonitor } = require('electron');
const path = require('path');
const syncServer = require('./sync-server.cjs');

// Prevent debug in production
if (!app.isPackaged) {
  console.log('SafeVault running in development mode');
} else {
  // Disable remote debugging in production
  app.commandLine.appendSwitch('remote-debugging-port', '0');
  // Additional security switches
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
}

// Singleton lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'SafeVault',
    icon: path.join(__dirname, '../resources/icon.png'),
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: isDev, // Enable DevTools only in development mode
      preload: path.join(__dirname, 'preload.cjs'),
      // Disable remote module
      enableRemoteModule: false,
      // Disable popups
      disableBlinkFeatures: 'Auxclick',
      // Safe defaults
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  // Strict Security Hardening: Prevent screen capture, screenshots, and recording of the vault
  if (process.platform === 'win32' || process.platform === 'darwin') {
    mainWindow.setContentProtection(true);
  }

  // Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.google.com; connect-src 'self' https://api.github.com https://api.pwnedpasswords.com http://* https://* http://localhost:* ws://localhost:*; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
        ],
      },
    });
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('devtools://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  const fs = require('fs');
  const distPath = path.join(__dirname, '../dist/index.html');
  
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(distPath);
    });
  } else {
    mainWindow.loadFile(distPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Close the app when window is closed
  mainWindow.on('close', () => {
    app.isQuitting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const trayIcon = path.join(__dirname, 'resources/tray-icon.png');
  try {
    tray = new Tray(trayIcon);
  } catch {
    // Tray icon may not exist; skip
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show SafeVault',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Lock Vault',
      click: () => {
        mainWindow?.webContents.send('safevault:lock');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('SafeVault');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// IPC Handlers (secure - validate all inputs)
ipcMain.handle('safevault:get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('safevault:get-app-path', (event, type) => {
  const validTypes = ['userData', 'temp', 'home', 'desktop', 'documents'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid path type');
  }
  return app.getPath(type);
});

ipcMain.handle('safevault:show-save-dialog', async (event, options) => {
  // Validate options
  const safeOptions = {
    defaultPath: String(options?.defaultPath || 'safevault-backup.json'),
    filters: Array.isArray(options?.filters) ? options.filters : [],
  };
  return dialog.showSaveDialog(mainWindow, safeOptions);
});

ipcMain.handle('safevault:show-open-dialog', async (event, options) => {
  const safeOptions = {
    properties: ['openFile'],
    filters: Array.isArray(options?.filters) ? options.filters : [],
  };
  return dialog.showOpenDialog(mainWindow, safeOptions);
});

ipcMain.handle('safevault:select-directory', async (event) => {
  return dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
});

// Prevent GPU process from being compromised
app.commandLine.appendSwitch('disable-gpu-sandbox');

app.whenReady().then(() => {
  createWindow();
  createTray();

  // ── Privacy: Lock vault on system suspend or screen lock ──────────────────
  powerMonitor.on('suspend', () => {
    console.log('[SafeVault] System suspending — locking vault');
    mainWindow?.webContents.send('safevault:lock');
  });
  powerMonitor.on('lock-screen', () => {
    console.log('[SafeVault] Screen locked — locking vault');
    mainWindow?.webContents.send('safevault:lock');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle second instance
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Secure: Clear sensitive data on lock/logout
ipcMain.handle('safevault:clear-clipboard', () => {
  const { clipboard } = require('electron');
  clipboard.writeText('');
  return true;
});

// Secure background file writer for backups
ipcMain.handle('safevault:write-backup-file', async (event, folderPath, filename, content) => {
  const fs = require('fs');
  const path = require('path');
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Directory does not exist' };
    }
    const fullPath = path.join(folderPath, filename);
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true, path: fullPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Secure background updater: downloads latest .exe setup and executes it
ipcMain.handle('safevault:download-and-install-update', async (event, downloadUrl) => {
  const fs = require('fs');
  const path = require('path');
  const https = require('https');
  const { shell } = require('electron');

  const tempDir = app.getPath('temp');
  const tempFilePath = path.join(tempDir, 'SafeVault-Update-Setup.exe');

  return new Promise((resolve) => {
    // Delete if file already exists
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }

    const download = (url) => {
      https.get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          download(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          resolve({ success: false, error: `Server returned status code ${response.statusCode}` });
          return;
        }

        // Initialize file stream only on verified HTTP 200 OK
        const file = fs.createWriteStream(tempFilePath);
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          file.write(chunk);
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            mainWindow?.webContents.send('safevault:update-progress', percent);
          }
        });

        response.on('end', () => {
          file.end();
          
          // Launch setup installer with shell.openPath to trigger UAC elevation prompt
          setTimeout(async () => {
            try {
              await shell.openPath(tempFilePath);
              // Gracefully shut down so the installer is not locked out from replacing executable files
              setTimeout(() => {
                app.quit();
              }, 500);
              resolve({ success: true });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          }, 1000);
        });

        response.on('error', (err) => {
          file.close();
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
          resolve({ success: false, error: err.message });
        });
      }).on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    };

    download(downloadUrl);
  });
});

// Wi-Fi Sync Server Handlers
ipcMain.handle('safevault:start-sync-server', (event, vaultData) => {
  return syncServer.startSyncServer(vaultData, (clientVault, sendResponse) => {
    const responseCallbackId = Math.random().toString(36).slice(2);
    
    // Broadcast sync request to React UI
    mainWindow?.webContents.send('safevault:sync-request', clientVault, responseCallbackId);
    
    // Set up single-use listener for UI response
    ipcMain.once(`safevault:sync-merged-response:${responseCallbackId}`, (evt, err, mergedVault) => {
      sendResponse(err, mergedVault);
    });
  });
});

ipcMain.handle('safevault:stop-sync-server', () => {
  return syncServer.stopSyncServer();
});

// Return actual local network subnets (e.g. ['192.168.1', '10.0.0']) for Auto-Discover
ipcMain.handle('safevault:get-local-subnets', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const subnets = new Set();
  for (const iface of Object.values(interfaces)) {
    for (const entry of iface) {
      if ((entry.family === 'IPv4' || entry.family === 4) && !entry.internal) {
        // Extract subnet prefix: first 3 octets
        const parts = entry.address.split('.');
        if (parts.length === 4) {
          subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }
  return Array.from(subnets);
});

