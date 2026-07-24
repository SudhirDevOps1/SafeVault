// SafeVault Extension Background Service Worker (Manifest V3)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "storeSessionKey") {
    chrome.storage.session.set({ encryptionKey: request.key })
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }

  if (request.action === "getSessionKey") {
    chrome.storage.session.get("encryptionKey")
      .then((data) => sendResponse({ key: data.encryptionKey || null }))
      .catch(() => sendResponse({ key: null }));
    return true;
  }

  if (request.action === "lockSession") {
    chrome.storage.session.remove("encryptionKey")
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
