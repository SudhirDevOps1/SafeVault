// SafeVault Extension Background Service Worker (Manifest V3)
// Zero-Knowledge Architecture with Bitwarden/Proton Pass style autofill & context menu integration

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

// Extract base domain for matching (e.g., login.example.com -> example.com)
function extractDomain(urlOrHost) {
  if (!urlOrHost) return '';
  try {
    let hostname = urlOrHost;
    if (urlOrHost.includes('://')) {
      hostname = new URL(urlOrHost).hostname;
    }
    hostname = hostname.toLowerCase().trim();
    hostname = hostname.split(':')[0];
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return urlOrHost.toLowerCase().trim();
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

// Setup Context Menus on Installation / Update
chrome.runtime.onInstalled.addListener(() => {
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
  if (!url || !url.startsWith('http')) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const session = await chrome.storage.session.get(['isUnlocked', 'credentialsJson']);
  if (!session.isUnlocked || !session.credentialsJson) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  try {
    const credentials = JSON.parse(session.credentialsJson);
    const domain = extractDomain(url);
    const matches = credentials.filter(c => {
      if (!c.url) return false;
      const cDomain = extractDomain(c.url);
      return cDomain && domain && (cDomain === domain || cDomain.includes(domain) || domain.includes(cDomain));
    });

    if (matches.length > 0) {
      await chrome.action.setBadgeText({ tabId, text: String(matches.length) });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' }); // Emerald Green
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {
    await chrome.action.setBadgeText({ tabId, text: '' });
  }
}

// Track Tab Updates to Update Badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadgeForTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
  if (tab?.url) {
    updateBadgeForTab(activeInfo.tabId, tab.url);
  }
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

// Main Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      // 1. Session Synchronization from Popup/React App
      case 'SYNC_VAULT_DATA': {
        const { credentials, isUnlocked, sessionKeyBase64, autoLockMinutes } = request;
        await chrome.storage.session.set({
          isUnlocked: !!isUnlocked,
          sessionKeyBase64: sessionKeyBase64 || null,
          credentialsJson: JSON.stringify(credentials || []),
          autoLockMinutes: autoLockMinutes || 15,
          lastSynced: Date.now()
        });

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

      // 2. Lock Session
      case 'LOCK_SESSION':
      case 'lockSession': {
        await chrome.storage.session.clear();
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
        const session = await chrome.storage.session.get(['isUnlocked', 'sessionKeyBase64']);
        sendResponse({
          isUnlocked: !!session.isUnlocked,
          hasKey: !!session.sessionKeyBase64
        });
        break;
      }

      // 4. Retrieve Matching Credentials with Live 2FA Codes
      case 'GET_MATCHING_CREDENTIALS': {
        const session = await chrome.storage.session.get(['isUnlocked', 'credentialsJson']);
        if (!session.isUnlocked || !session.credentialsJson) {
          sendResponse({ isUnlocked: false, credentials: [] });
          return;
        }

        try {
          const credentials = JSON.parse(session.credentialsJson);
          const targetUrl = request.url || sender.tab?.url || '';
          const targetDomain = extractDomain(targetUrl);

          const matches = credentials.filter(c => {
            if (!c.url && !c.title) return false;
            const cDomain = extractDomain(c.url);
            const titleMatch = targetDomain && c.title && c.title.toLowerCase().includes(targetDomain);
            return (cDomain && targetDomain && (cDomain === targetDomain || cDomain.includes(targetDomain) || targetDomain.includes(cDomain))) || titleMatch;
          });

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
            credentials: resolvedMatches
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

      default:
        sendResponse({ unhandled: true });
    }
  })();
  return true; // Keep message channel open for async response
});
