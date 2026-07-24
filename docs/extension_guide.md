# 🧩 SafeVault Companion Browser Extension Guide

This guide explains the architecture, security parameters, installation steps, and form autofill mechanism of the **SafeVault Browser Extension**.

---

## 🏗️ How it Works: Architecture & Sandboxing

The extension consists of three core layers that work together to securely autofill credentials without exposing your database to target webpages:

```
[ POPUP: popup.html ]  ◄──loads──► [ Privileged Iframe: dist/index.html ]
        │                                  │ (Argon2id + AES decryption)
        │ message                          │
        ▼                                  ▼
[ BACKGROUND: background.js ]  ◄── E2EE session storage (in-memory lock)
        │
        │ chrome.tabs.sendMessage()
        ▼
[ CONTENT: content.js ] ──► [ Target Login Form Inputs ]
                            (Injects username / password)
```

1. **Privileged UI Popup (`popup.html`):** 
   * Loads the fully compiled local production bundle (`dist/index.html`) inside an `<iframe>`.
   * Inherits the exact same zero-knowledge encryption store (Zustand + IndexedDB) as the desktop/web clients.
2. **Session Key Manager (`background.js`):**
   * Runs as a background service worker using Manifest V3.
   * Keeps track of the transient session key in secure browser session storage (`chrome.storage.session`). This ensures that closing the popup doesn't instantly relock the vault, but closing the browser wipes the key.
3. **Autofill Injection Script (`content.js`):**
   * Injected dynamically into active webpages.
   * Scans document elements to find login fields (username/email and password) and cleanly updates input values.

---

## 🔒 Security Specifications

* **Isolation boundary:** Webpages have zero access to the `popup.html` or the database stored in `IndexedDB`.
* **Autofill trigger:** Credentials are never auto-injected automatically on page load. Autofill only executes when you explicitly click a credential card inside the extension popup and click "Autofill". This prevents phishing pages from reading your credentials silently.
* **Transient Clipboard:** Copying passwords within the extension panel uses the same 30-second clipboard scrub hook to clear secrets.

---

## 🛠️ Step-by-Step Installation (Chrome / Chromium Edge / Brave)

Since the extension companion is locally bundled in your repository, you can load it instantly as a developer:

1. **Build the production bundle:** Ensure you compile the client first:
   ```bash
   npm run build
   ```
2. **Open Extensions page:** In Chrome, navigate to:
   ```text
   chrome://extensions/
   ```
3. **Enable Developer Mode:** Toggle the **Developer mode** switch in the top-right corner.
4. **Load Unpacked:** Click **Load unpacked** in the top-left corner.
5. **Select Folder:** Select the `/extension` directory inside the SafeVault project folder.
6. **Pin Extension:** Click the puzzle icon in your browser toolbar and pin **SafeVault Authenticator & Manager** for instant access.

---

## 📖 How to Autofill Credentials

1. Open a target login page (e.g. `github.com/login`).
2. Click the **SafeVault** extension icon and unlock your vault.
3. Select your credential card and click the **Autofill** button.
4. The extension will automatically find the login inputs, inject the values, and trigger input change events to ensure compatibilities with modern login portals.
