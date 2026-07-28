// SafeVault Extension Background Service Worker (Manifest V3)
// NOTE: CryptoKey objects are NOT serializable via chrome.storage APIs.
// We store the raw AES key bytes (ArrayBuffer exported as base64) instead,
// and re-import as CryptoKey on retrieval. This is safe because chrome.storage.session
// is sandboxed to the extension and cleared when the browser session ends.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "storeSessionKey") {
    // Expect request.keyBase64 = base64-encoded raw 32-byte AES-256 key
    chrome.storage.session.set({ encryptionKeyBase64: request.keyBase64 })
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === "getSessionKey") {
    chrome.storage.session.get("encryptionKeyBase64")
      .then((data) => sendResponse({ keyBase64: data.encryptionKeyBase64 || null }))
      .catch(() => sendResponse({ keyBase64: null }));
    return true;
  }

  if (request.action === "lockSession") {
    chrome.storage.session.remove("encryptionKeyBase64")
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
