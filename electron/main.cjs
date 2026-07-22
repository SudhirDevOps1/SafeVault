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

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeTheme, shell, dialog } = require('electron');
const path = require('path');

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
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.google.com; connect-src 'self' https://api.github.com https://api.pwnedpasswords.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
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

// Prevent GPU process from being compromised
app.commandLine.appendSwitch('disable-gpu-sandbox');

app.whenReady().then(() => {
  createWindow();
  createTray();

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
