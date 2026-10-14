// SafeVault Extension Background Service Worker (Manifest V3)
// Zero-Knowledge Architecture with Bitwarden/Proton Pass style autofill & context menu integration

// Cryptographically secure password generator
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
    // Remove port if present
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
    // Send generated password directly to active input in tab
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

// Main Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      // 1. Session Synchronization from Popup/React App
      case 'SYNC_VAULT_DATA': {
        const { credentials, isUnlocked, sessionKeyBase64 } = request;
        await chrome.storage.session.set({
          isUnlocked: !!isUnlocked,
          sessionKeyBase64: sessionKeyBase64 || null,
          credentialsJson: JSON.stringify(credentials || []),
          lastSynced: Date.now()
        });

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

      // 4. Retrieve Matching Credentials for Content Script / Page
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

          sendResponse({
            isUnlocked: true,
            credentials: matches.map(c => ({
              id: c.id,
              title: c.title,
              username: c.username,
              password: c.password,
              url: c.url,
              totpSecret: c.totpSecret || ''
            }))
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

      // 6. Autofill Specific Tab
      case 'AUTOFILL_TAB': {
        const tabId = request.tabId || sender.tab?.id;
        if (tabId) {
          chrome.tabs.sendMessage(tabId, {
            action: 'autofillCredentials',
            username: request.username,
            password: request.password
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
            // Check if existing credential with same username & domain exists
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
          // If locked, store in pending session queue
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
