// SafeVault Extension Background Service Worker (Manifest V3)
// Zero-Knowledge Architecture with Bitwarden/Proton Pass style autofill & context menu integration

// Allow storage.session to be accessed by popup and extension pages in MV3
try {
  if (typeof chrome !== 'undefined' && chrome.storage?.session?.setAccessLevel) {
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});
  }
} catch {}

// Decode Base32 string to Uint8Array for TOTP
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = (base32 || '').replace(/[\s=-]/g, '').toUpperCase();
  let bits = '';
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

// Calculate RFC 6238 TOTP Code
async function calculateTOTP(secret, digits = 6, period = 30) {
  if (!secret) return '';
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / period);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, Math.floor(counter / 0x100000000));
    view.setUint32(4, counter & 0xffffffff);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
    const bytes = new Uint8Array(hmac);
    const offset = bytes[bytes.length - 1] & 0x0f;
    const code =
      ((bytes[offset] & 0x7f) << 24) |
      ((bytes[offset + 1] & 0xff) << 16) |
      ((bytes[offset + 2] & 0xff) << 8) |
      (bytes[offset + 3] & 0xff);
    return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
  } catch {
    return '';
  }
}

// Cryptographically secure password generator with guaranteed diversity
function generateSecurePassword(length = 20) {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const chars = letters + digits + symbols;
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  const result = Array.from(array, x => chars[x % chars.length]);
  if (length >= 3) {
    result[0] = letters[array[0] % letters.length];
    result[1] = digits[array[1] % digits.length];
    result[2] = symbols[array[2] % symbols.length];
  }
  return result.join('');
}

const MULTI_PART_TLDS = [
  'co.uk', 'co.in', 'com.au', 'com.br', 'co.jp', 'co.nz', 'co.za',
  'org.uk', 'gov.in', 'ac.uk', 'pages.dev', 'github.io', 'web.app'
];

// Extract base domain for matching (e.g., login.example.com -> example.com)
function extractDomain(urlOrHost) {
  if (!urlOrHost) return '';
  try {
    let hostname = urlOrHost;
    if (urlOrHost.includes('://')) {
      hostname = new URL(urlOrHost).hostname;
    }
    hostname = hostname.toLowerCase().trim().split(':')[0].replace(/^www\./, '');
    for (const tld of MULTI_PART_TLDS) {
      if (hostname.endsWith('.' + tld)) {
        const sub = hostname.slice(0, -(tld.length + 1)).split('.');
        const domainName = sub[sub.length - 1];
        return domainName ? `${domainName}.${tld}` : hostname;
      }
    }
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return urlOrHost.toLowerCase().trim();
  }
}

// Extract clean service name (e.g. accounts.google.com -> google, github.com -> github, amazon.co.in -> amazon)
function extractCleanServiceName(urlOrHost) {
  if (!urlOrHost) return 'service';
  try {
    let hostname = urlOrHost.trim();
    if (hostname.includes('://')) {
      hostname = new URL(hostname).hostname;
    }
    hostname = hostname.toLowerCase().split(':')[0].replace(/^www\./, '');

    for (const tld of MULTI_PART_TLDS) {
      if (hostname.endsWith('.' + tld)) {
        const sub = hostname.slice(0, -(tld.length + 1)).split('.');
        const candidate = sub[sub.length - 1];
        if (candidate) return candidate.replace(/[^a-z0-9]/g, '');
      }
    }

    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2].replace(/[^a-z0-9]/g, '') || 'service';
    }
    return parts[0].replace(/[^a-z0-9]/g, '') || 'service';
  } catch {
    return 'service';
  }
}

// Extract normalized full hostname (e.g. accounts.google.com)
function extractFullHostname(urlOrHost) {
  if (!urlOrHost) return '';
  try {
    let hostname = urlOrHost.trim();
    if (hostname.includes('://')) {
      hostname = new URL(hostname).hostname;
    }
    return hostname.toLowerCase().split(':')[0].replace(/^www\./, '');
  } catch {
    return urlOrHost.toLowerCase().trim();
  }
}

// Check if a credential matches a target website based on user's Autofill Matching Mode
function isCredentialMatch(c, targetUrl, matchingMode) {
  if (!c.url && !c.title) return false;
  const targetHost = extractFullHostname(targetUrl);
  const credHost = extractFullHostname(c.url);
  const targetBase = extractDomain(targetUrl);
  const credBase = extractDomain(c.url);
  const targetService = extractCleanServiceName(targetUrl);

  if (matchingMode === 'exact') {
    return Boolean(credHost && targetHost && credHost === targetHost);
  } else if (matchingMode === 'subdomain') {
    if (credHost && targetHost && credHost === targetHost) return true;
    return Boolean(credBase && targetBase && credBase === targetBase);
  } else {
    // 'wildcard' (default): URL + subdomain + name wildcard
    if (credHost && targetHost && credHost === targetHost) return true;
    if (credBase && targetBase && (credBase === targetBase || credBase.includes(targetBase) || targetBase.includes(credBase))) return true;
    if (c.title && targetService && c.title.toLowerCase().includes(targetService)) return true;
    if (c.title && targetBase && c.title.toLowerCase().includes(targetBase)) return true;
    return false;
  }
}

// Broadcast Vault State Change to all browser tabs
function broadcastVaultState(isUnlocked) {
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || !Array.isArray(tabs)) return;
    tabs.forEach(tab => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'VAULT_STATE_UPDATED', isUnlocked: !!isUnlocked }).catch(() => {});
      }
    });
  });
}

// Check for extension updates against GitHub releases
async function checkExtensionUpdates() {
  try {
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version || '0.3.0';
    
    // Check if network is permitted
    const local = await chrome.storage.local.get(['strictOfflineMode', 'checkForUpdates']);
    if (local.strictOfflineMode) return { hasUpdate: false, latestVersion: null };
    if (local.checkForUpdates === false) return { hasUpdate: false, latestVersion: null };

    const res = await fetch('https://api.github.com/repos/SudhirDevOps1/SafeVault/releases/latest');
    if (!res.ok) return { hasUpdate: false, latestVersion: null };
    const release = await res.json();
    const latestVersion = (release.tag_name || '').replace(/^v/, '');

    const parseSemver = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
    const l = parseSemver(latestVersion);
    const c = parseSemver(currentVersion);
    let isNewer = false;
    for (let i = 0; i < Math.max(l.length, c.length); i++) {
      if ((l[i] || 0) > (c[i] || 0)) { isNewer = true; break; }
      if ((l[i] || 0) < (c[i] || 0)) { isNewer = false; break; }
    }

    if (isNewer) {
      // Set toolbar action badge
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // SafeVault Emerald Green
      chrome.action.setTitle({ title: `SafeVault update v${latestVersion} available! Click to update.` });
      await chrome.storage.local.set({
        safevault_update_available: latestVersion,
        safevault_update_release_notes: release.body || '',
        safevault_update_url: release.html_url,
      });
      return { hasUpdate: true, latestVersion };
    } else {
      chrome.action.setBadgeText({ text: '' });
      await chrome.storage.local.remove(['safevault_update_available']);
      return { hasUpdate: false, latestVersion: null };
    }
  } catch {
    return { hasUpdate: false, latestVersion: null };
  }
}

// Periodic update checks via Alarms API (every 4 hours)
try {
  chrome.alarms.create('check_safevault_updates', { periodInMinutes: 240 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'check_safevault_updates') {
      checkExtensionUpdates();
    }
  });
} catch {}

// Setup Context Menus and Handle Non-Destructive Update Migration
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details?.reason === 'update') {
    // Non-destructive migration safety snapshot: Backup storage before touching anything
    try {
      const allLocal = await chrome.storage.local.get(null);
      await chrome.storage.local.set({
        safevault_update_migration_backup: {
          timestamp: Date.now(),
          previousVersion: details.previousVersion,
          currentVersion: chrome.runtime.getManifest().version,
          data: allLocal
        }
      });
    } catch {}
  }

  // Setup Context Menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'safevault-root',
      title: 'SafeVault',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'safevault-autofill',
      parentId: 'safevault-root',
      title: 'Auto-fill Login (Ctrl+Shift+L)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'safevault-generate',
      parentId: 'safevault-root',
      title: 'Generate Secure Password (Ctrl+Shift+9)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'safevault-open',
      parentId: 'safevault-root',
      title: 'Open SafeVault Vault',
      contexts: ['all']
    });
  });

  // Seamlessly re-inject content scripts into all open web tabs to eliminate 'Extension context invalidated'
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    if (Array.isArray(tabs)) {
      for (const tab of tabs) {
        if (tab?.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
          chrome.scripting?.executeScript?.({
            target: { tabId: tab.id },
            files: ['content.js']
          }).catch(() => {});
        }
      }
    }
  } catch {}

  // Check for new updates
  checkExtensionUpdates();
});

chrome.runtime.onStartup?.addListener(() => {
  checkExtensionUpdates();
});

// Handle Context Menu Actions
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'safevault-autofill') {
    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTOFILL' }).catch(() => {});
  } else if (info.menuItemId === 'safevault-generate') {
    const password = generateSecurePassword(20);
    chrome.tabs.sendMessage(tab.id, { action: 'FILL_GENERATED_PASSWORD', password }).catch(() => {});
  } else if (info.menuItemId === 'safevault-open') {
    chrome.action.openPopup?.().catch(() => {});
  }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'autofill_credential') {
    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTOFILL' }).catch(() => {});
  } else if (command === 'generate_password') {
    const password = generateSecurePassword(20);
    chrome.tabs.sendMessage(tab.id, { action: 'FILL_GENERATED_PASSWORD', password }).catch(() => {});
  }
});

// Update Badge Count for Current Tab
async function updateBadgeForTab(tabId, url) {
  if (!tabId || !url || !url.startsWith('http')) {
    if (tabId) {
      try { await chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}); } catch {}
    }
    return;
  }
  try {
    let isUnlocked = inMemorySession.isUnlocked;
    let credentialsJson = inMemorySession.credentialsJson;
    if (!isUnlocked) {
      const session = await chrome.storage.session.get(['isUnlocked', 'credentialsJson']).catch(() => ({}));
      isUnlocked = !!session?.isUnlocked;
      credentialsJson = session?.credentialsJson || '[]';
    }
    if (!isUnlocked || !credentialsJson || credentialsJson === '[]') {
      try { await chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}); } catch {}
      return;
    }

    // Check autofill settings & blocked sites
    const localData = await chrome.storage.local.get(['safevault_autofill_settings']).catch(() => ({}));
    let settings = { autofillMatchingMode: 'wildcard', blockedSites: [] };
    if (localData?.safevault_autofill_settings) {
      try { settings = JSON.parse(localData.safevault_autofill_settings); } catch {}
    }

    const targetHost = extractFullHostname(url);
    const isBlocked = (settings.blockedSites || []).some(b => {
      const clean = (b || '').toLowerCase().trim();
      return clean && (targetHost === clean || targetHost.endsWith('.' + clean));
    });

    if (isBlocked) {
      try { await chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}); } catch {}
      return;
    }

    const credentials = JSON.parse(credentialsJson);
    const matches = credentials.filter(c => isCredentialMatch(c, url, settings.autofillMatchingMode || 'wildcard'));

    if (matches.length > 0) {
      await chrome.action.setBadgeText({ tabId, text: String(matches.length) }).catch(() => {});
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' }).catch(() => {}); // Emerald Green
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    }
  } catch {
    try { await chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}); } catch {}
  }
}

// Track Tab Updates to Update Badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    updateBadgeForTab(tabId, tab.url).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
    if (tab?.url) {
      updateBadgeForTab(activeInfo.tabId, tab.url).catch(() => {});
    }
  } catch {}
});

// Background Auto-Lock Alarms & Idle Detection
chrome.alarms?.create('safevault-auto-lock-check', { periodInMinutes: 1 });
chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'safevault-auto-lock-check') {
    const session = await chrome.storage.session.get(['isUnlocked', 'lastSynced', 'autoLockMinutes']);
    const timeoutMs = (session.autoLockMinutes || 15) * 60 * 1000;
    if (session.isUnlocked && session.lastSynced && Date.now() - session.lastSynced > timeoutMs) {
      await chrome.storage.session.clear();
      broadcastVaultState(false);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      }
    }
  }
});

chrome.idle?.onStateChanged?.addListener(async (state) => {
  if (state === 'locked') {
    await chrome.storage.session.clear();
    broadcastVaultState(false);
  }
});

// In-Memory Session Cache for instant zero-latency retrieval
let inMemorySession = {
  isUnlocked: false,
  credentialsJson: '[]',
  sessionKeyBase64: null,
  lastSynced: 0
};

// Main Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
      // 0. Trigger popup opening from in-field badge/dropdown
      case 'OPEN_POPUP': {
        if (chrome.action?.openPopup) {
          chrome.action.openPopup().catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      // 1. Session Synchronization from Popup/React App
      case 'SYNC_VAULT_DATA': {
        const { credentials, isUnlocked, sessionKeyBase64, autoLockMinutes, baseEmails, autofillSettings } = request;
        const credsStr = JSON.stringify(credentials || []);
        inMemorySession = {
          isUnlocked: !!isUnlocked,
          sessionKeyBase64: sessionKeyBase64 || null,
          credentialsJson: credsStr,
          lastSynced: Date.now()
        };
        try {
          await chrome.storage.session.set({
            isUnlocked: !!isUnlocked,
            sessionKeyBase64: sessionKeyBase64 || null,
            credentialsJson: credsStr,
            autoLockMinutes: autoLockMinutes || 15,
            lastSynced: Date.now()
          });
        } catch {}
        if (baseEmails && Array.isArray(baseEmails)) {
          await chrome.storage.local.set({ safevault_base_emails: JSON.stringify(baseEmails) });
        }
        if (autofillSettings) {
          await chrome.storage.local.set({ safevault_autofill_settings: JSON.stringify(autofillSettings) });
        }

        // Broadcast to all active tabs so in-field dropdowns immediately refresh
        broadcastVaultState(!!isUnlocked);

        // Update active tab badge
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url) {
          updateBadgeForTab(tab.id, tab.url);
        }
        sendResponse({ success: true });
        break;
      }

      // Sync Autofill Settings explicitly
      case 'SYNC_AUTOFILL_SETTINGS': {
        if (request.settings) {
          await chrome.storage.local.set({ safevault_autofill_settings: JSON.stringify(request.settings) });
          // Broadcast to tabs
          chrome.tabs.query({}, (tabs) => {
            if (Array.isArray(tabs)) {
              tabs.forEach(tab => {
                if (tab?.id) {
                  chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_SETTINGS_UPDATED', settings: request.settings }).catch(() => {});
                }
              });
            }
          });
        }
        sendResponse({ success: true });
        break;
      }

      // Block a site
      case 'BLOCK_SITE': {
        const siteToBlock = extractFullHostname(request.domain || request.hostname);
        if (siteToBlock) {
          const localData = await chrome.storage.local.get(['safevault_autofill_settings']);
          let settings = { blockedSites: [] };
          if (localData?.safevault_autofill_settings) {
            try { settings = JSON.parse(localData.safevault_autofill_settings); } catch {}
          }
          if (!settings.blockedSites) settings.blockedSites = [];
          if (!settings.blockedSites.includes(siteToBlock)) {
            settings.blockedSites.push(siteToBlock);
            await chrome.storage.local.set({ safevault_autofill_settings: JSON.stringify(settings) });
            chrome.tabs.query({}, (tabs) => {
              if (Array.isArray(tabs)) {
                tabs.forEach(tab => {
                  if (tab?.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_SETTINGS_UPDATED', settings }).catch(() => {});
                  }
                });
              }
            });
          }
        }
        sendResponse({ success: true });
        break;
      }

      // 2. Lock Session
      case 'LOCK_SESSION':
      case 'lockSession': {
        inMemorySession = {
          isUnlocked: false,
          sessionKeyBase64: null,
          credentialsJson: '[]',
          lastSynced: 0
        };
        try {
          await chrome.storage.session.clear();
        } catch {}
        broadcastVaultState(false);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
        }
        sendResponse({ success: true });
        break;
      }

      // 3. Check Session Status
      case 'IS_VAULT_UNLOCKED': {
        let isUnlocked = inMemorySession.isUnlocked;
        let hasKey = !!inMemorySession.sessionKeyBase64;
        if (!isUnlocked) {
          try {
            const session = await chrome.storage.session.get(['isUnlocked', 'sessionKeyBase64']);
            isUnlocked = !!session?.isUnlocked;
            hasKey = !!session?.sessionKeyBase64;
            if (isUnlocked) {
              inMemorySession.isUnlocked = true;
              inMemorySession.sessionKeyBase64 = session.sessionKeyBase64;
            }
          } catch {}
        }
        sendResponse({
          isUnlocked: !!isUnlocked,
          hasKey: !!hasKey
        });
        break;
      }

      // 4. Retrieve Matching Credentials with Live 2FA Codes
      case 'GET_MATCHING_CREDENTIALS': {
        let isUnlocked = inMemorySession.isUnlocked;
        let credentialsJson = inMemorySession.credentialsJson;

        if (!isUnlocked || !credentialsJson || credentialsJson === '[]') {
          try {
            const session = await chrome.storage.session.get(['isUnlocked', 'credentialsJson']);
            if (session?.isUnlocked && session?.credentialsJson) {
              isUnlocked = true;
              credentialsJson = session.credentialsJson;
              inMemorySession.isUnlocked = true;
              inMemorySession.credentialsJson = credentialsJson;
            }
          } catch {}
        }

        if (!isUnlocked || !credentialsJson || credentialsJson === '[]') {
          sendResponse({ isUnlocked: false, credentials: [] });
          return;
        }

        try {
          const localData = await chrome.storage.local.get(['safevault_autofill_settings']);
          let settings = { autofillMatchingMode: 'wildcard', blockedSites: [] };
          if (localData?.safevault_autofill_settings) {
            try { settings = JSON.parse(localData.safevault_autofill_settings); } catch {}
          }

          const targetUrl = request.url || sender.tab?.url || '';
          const targetHost = extractFullHostname(targetUrl);
          const isBlocked = (settings.blockedSites || []).some(b => {
            const clean = (b || '').toLowerCase().trim();
            return clean && (targetHost === clean || targetHost.endsWith('.' + clean));
          });

          if (isBlocked) {
            sendResponse({ isUnlocked: true, credentials: [], isBlocked: true });
            return;
          }

          const credentials = JSON.parse(credentialsJson);
          const matches = credentials.filter(c => isCredentialMatch(c, targetUrl, settings.autofillMatchingMode || 'wildcard'));

          // Compute live TOTP codes for all matching credentials
          const resolvedMatches = await Promise.all(matches.map(async c => ({
            id: c.id,
            title: c.title,
            username: c.username,
            password: c.password,
            url: c.url,
            totpSecret: c.totpSecret || '',
            totpCode: c.totpSecret ? await calculateTOTP(c.totpSecret, c.totpDigits || 6, c.totpPeriod || 30) : ''
          })));

          sendResponse({
            isUnlocked: true,
            credentials: resolvedMatches,
            isBlocked: false
          });
        } catch (err) {
          sendResponse({ isUnlocked: true, credentials: [], error: err.message });
        }
        break;
      }

      // 5. Generate Secure Password
      case 'GENERATE_PASSWORD': {
        const length = request.length || 20;
        sendResponse({ password: generateSecurePassword(length) });
        break;
      }

      // 6. Autofill Specific Tab with 2FA Code
      case 'AUTOFILL_TAB': {
        const tabId = request.tabId || sender.tab?.id;
        if (tabId) {
          let totpCode = request.totpCode || '';
          if (!totpCode && request.totpSecret) {
            totpCode = await calculateTOTP(request.totpSecret);
          }

          chrome.tabs.sendMessage(tabId, {
            action: 'autofillCredentials',
            username: request.username,
            password: request.password,
            totpCode
          }).then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
        break;
      }

      // 7. Save Newly Detected / Updated Credential from Form Submission
      case 'SAVE_SUBMITTED_CREDENTIAL': {
        const { username, password, url, title } = request;
        if (!password) {
          sendResponse({ success: false, error: 'No password to save' });
          return;
        }

        const session = await chrome.storage.session.get(['isUnlocked', 'credentialsJson']);
        if (session.isUnlocked && session.credentialsJson) {
          try {
            const credentials = JSON.parse(session.credentialsJson);
            const domain = extractDomain(url);
            const existingIndex = credentials.findIndex(c => {
              const cDomain = extractDomain(c.url);
              return cDomain === domain && c.username === username;
            });

            if (existingIndex >= 0) {
              credentials[existingIndex].password = password;
              credentials[existingIndex].updatedAt = Date.now();
            } else {
              credentials.push({
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
                title: title || domain || 'Web Login',
                url: url || '',
                username: username || '',
                password: password,
                notes: 'Saved automatically by SafeVault Extension',
                totpSecret: '',
                category: 'Logins',
                favorite: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            }

            await chrome.storage.session.set({
              credentialsJson: JSON.stringify(credentials),
              pendingSync: true
            });

            sendResponse({ success: true, isNew: existingIndex === -1 });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        } else {
          await chrome.storage.session.set({
            pendingSaveCredential: { username, password, url, title, timestamp: Date.now() }
          });
          sendResponse({ success: true, queued: true });
        }
        break;
      }

      // 8. Generate and Save Unlimited Email Alias directly from In-Field Pill
      case 'GENERATE_AND_SAVE_ALIAS': {
        const { hostname, url, format = 'plus' } = request;
        const service = extractCleanServiceName(hostname || url);

        // Retrieve user's configured base email or default
        const localData = await chrome.storage.local.get(['safevault_base_emails']);
        let baseEmail = 'admin@gmail.com';
        if (localData?.safevault_base_emails) {
          try {
            const list = JSON.parse(localData.safevault_base_emails);
            if (Array.isArray(list) && list[0]) baseEmail = list[0];
          } catch {}
        }

        let alias = '';
        if (baseEmail.startsWith('@')) {
          alias = `${service}${baseEmail}`;
        } else if (baseEmail.includes('@')) {
          const [u, d] = baseEmail.split('@');
          if (format === 'dot') {
            alias = `${u}.${service}@${d}`;
          } else {
            alias = `${u}+${service}@${d}`;
          }
        } else {
          alias = `${service}@safevault.local`;
        }

        const generatedPassword = generateSecurePassword(24);

        const session = await chrome.storage.session.get(['isUnlocked', 'credentialsJson']);
        if (session.isUnlocked && session.credentialsJson) {
          try {
            const credentials = JSON.parse(session.credentialsJson);
            const capitalizedTitle = service.charAt(0).toUpperCase() + service.slice(1);
            credentials.push({
              id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
              title: `${capitalizedTitle} Alias`,
              url: url || `https://${hostname}`,
              username: alias,
              password: generatedPassword,
              notes: `Auto-generated email alias from ${baseEmail} for ${service}`,
              totpSecret: '',
              category: 'Alias',
              aliasStatus: 'active',
              aliasBaseEmail: baseEmail,
              favorite: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });

            await chrome.storage.session.set({
              credentialsJson: JSON.stringify(credentials),
              pendingSync: true
            });
          } catch {}
        }

        sendResponse({ success: true, alias, password: generatedPassword, baseEmail, service });
        break;
      }

      // 9. Omni-Platform Update Notification & Trigger
      case 'SAFEVAULT_UPDATE_DETECTED': {
        const { version } = request;
        if (version) {
          chrome.action.setBadgeText({ text: 'NEW' });
          chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
          chrome.action.setTitle({ title: `SafeVault update ${version} available! Click to update.` });
          await chrome.storage.local.set({ safevault_update_available: version });
        }
        sendResponse({ success: true });
        break;
      }

      case 'CHECK_FOR_UPDATES_NOW': {
        const result = await checkExtensionUpdates();
        sendResponse({ success: true, ...result });
        break;
      }

      case 'CLEAR_UPDATE_BADGE': {
        chrome.action.setBadgeText({ text: '' });
        await chrome.storage.local.remove(['safevault_update_available']);
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ unhandled: true });
    }
    } catch (err) {
      sendResponse({ error: err?.message || 'Error processing request' });
    }
  })();
  return true; // Keep message channel open for async response
});
