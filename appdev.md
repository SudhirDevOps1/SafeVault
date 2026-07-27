# 🛠️ SafeVault Internal Developer Guide (`appdev.md`)

> **IMPORTANT:** This is an internal developer reference file. It is ignored by Git (`.gitignore`) and must never be committed to public repositories.

---

## 1. 📖 Architectural Philosophy

SafeVault is designed as a **100% Offline-First, Zero-Knowledge** credential manager. Every design decision, dependency addition, and feature implementation must adhere to these three core pillars:

1. **Zero-Knowledge:** The application must never know the user's Master Password. All encryption keys are derived client-side and exist only in transient React/Zustand state memory.
2. **Strict Offline Operation:** By default, no network requests are allowed. If the user opts-in to features like update notifications or future cloud syncs, the connections must be whitelisted under a strict Content Security Policy (CSP).
3. **OS-Level Hardening:** The app must defend against client-side vectors like screenshots, screen sharing, clipboard snooping, and OS-level keyboard/dictionary logging.

---

## 2. 🔌 Core Technology Stack

* **Frontend Runtime:** React 19 (TypeScript)
* **Desktop Shell:** Electron 30+ (Context Isolation + Sandbox enabled)
* **Local Database:** IndexedDB wrapped with Dexie.js (for ACID transactions and easy schema migrations)
* **Global State:** Zustand (for lightweight, in-memory reactive state flow)
* **Styling System:** Tailwind CSS + Vanilla CSS custom variables for seamless theme rendering
* **Unit Testing:** Vitest + React Testing Library (mocking browser globals via jsdom while using native Node WebCrypto for actual cryptographical operations)

---

## 3. 📂 Workspace Directory Map

```text
├── .github/                 # CI/CD Workflows (CodeQL Scans, Vitest, Release builds)
├── docs/                    # Public repository documentation (CHANGELOG, SECURITY, etc.)
├── electron/
│   ├── main.cjs             # Electron main process (security configurations, window creation)
│   └── preload.cjs          # Context-isolated IPC bridge between node and renderer
├── resources/               # Build assets, icon.ico, icon.png
├── src/
│   ├── components/          # Reusable UI React modules (Settings, Dashboard, CredentialForm)
│   ├── hooks/               # Custom React hooks (useAutoLock, useClipboard)
│   ├── stores/              # State management (vaultStore.ts is the single source of truth)
│   ├── test/                # Test suites & setup (setup.ts mock definitions, *.test.ts specs)
│   ├── utils/               # Native utility helpers (crypto.ts, totp.ts, importer.ts)
│   └── types.ts             # Global TypeScript type definitions
├── electron-builder.json    # Packaging parameters (NSIS configurations, shortcuts, output folders)
└── appdev.md                # [IGNORED] This document
```

---

## 4. 🔒 Advanced Security Implementations

### A. Key Derivation & Encryption Parameters
* **PBKDF2 Derivation:** Derived keys use **600,000 iterations** of PBKDF2 with a **SHA-512** hashing function. Salt bytes are generated locally using cryptographically secure random numbers (`crypto.getRandomValues`).
* **AES-GCM 256-bit:** Encryption uses AES-GCM with a **12-byte unique IV** (Initialization Vector) per entry, preventing patterns in encrypted text.

### B. OS Hardening
* **Anti-Screen Capture:** Leverages Win32/macOS system APIs via Electron:
  ```javascript
  mainWindow.setContentProtection(true);
  ```
  This makes the window appear blank or black in screenshots, video captures, and screen-sharing programs (Zoom, Teams, Discord).
* **Clipboard Scrubbing:** Plaintext credentials copied to the clipboard are cleared after a maximum delay of **30 seconds**. Additionally, calling the `lockVault` action immediately triggers:
  ```javascript
  navigator.clipboard.writeText('');
  ```
  to wipe passwords when the user locks their session.
* **Input Field Hardening:** To prevent keyloggers and operating system keyboard managers from caching typed master passwords in local dictionaries, inputs are configured with:
  * `spellCheck={false}`
  * `autoCorrect="off"`
  * `autoCapitalize="none"`

---

## 5. 🚀 Production-Grade Application Requirements

Before releasing SafeVault to public distribution channels, the following production-grade requirements must be addressed:

### A. Code Signing Certificates
* **Windows (SmartScreen bypass):** Requires a Microsoft-approved EV (Extended Validation) or standard Code Signing Certificate. Without this, users will see "Windows protected your PC" (SmartScreen) warnings when running the installer.
* **macOS (Gatekeeper bypass):** Requires joining the Apple Developer Program and signing the `.app`/`.dmg` using Developer ID certificates, followed by submitting the build to Apple's Notarization service via `xcrun altool`.

### B. Sandboxing and Multi-Process Security
* **IPC Isolation:** Keep the Electron main process sandbox-enabled. Never expose native `require` or Node.js APIs directly to the renderer process. All interactions must pass through the `preload.cjs` context bridge using granular, safe channels.

### C. Build and Packaging Pipelines
* **Vite Single-File Inlining:** Desktop assets must be bundled into a single file to prevent file path exposure and improve app load speeds inside Electron shells.
* **NSIS Packaging:** `electron-builder` must be configured to generate custom installers that support desktop shortcuts and auto-launch parameters on boot.

---

## 6. 💻 CLI Tool Architecture (Future Proposal)

To support advanced developer workflows without compromising the security model, a CLI tool can be integrated under the following design criteria:

### A. Shared Local Storage Specification
* **Database File (`~/.config/safevault/vault.db`):** Both GUI and CLI will interact with the same encrypted payload file.
* **Lock Mechanisms:** File locking must be implemented to prevent concurrent write collisions between the Electron shell and the CLI terminal.

### B. Command Security Requirements
* **Local Crypto Decrypt:** Key derivation must run inside the local CLI process memory using Node's `node:crypto` library with the same 600K PBKDF2 parameters.
* **Transient Session Daemon:** A secure memory daemon (temporary key caching in RAM with TTL e.g. 15 mins) must be built to avoid prompting the user for their Master Password on every command.
* **Clipboard Clearing:** Commands like `safevault get <title>` must trigger auto-clear timeouts on system clipboard contents using standard shell buffers.

---

## 📝 Documentation & Quality Standards

1. **Keep a Changelog:** All features and security patches must be documented in `docs/CHANGELOG.md` following Semantic Versioning (SemVer) guidelines.
2. **100% Test Coverage:** All core helpers under `src/utils/` must have corresponding test specs in `src/test/`. Mocks in `src/test/setup.ts` must be overridden in specific files using native Node crypto modules when testing real cryptographic cycles.

---

## 🛰️ 7. Local Wi-Fi Sync Cryptographic Security Specification

Local synchronization operates on a **Zero-Trust Network model**. It assumes that the local Wi-Fi router, IP subnet, and active network packets are fully compromised or monitored by malicious eavesdroppers. Since deploying trusted local SSL/TLS certificates on temporary private IP ranges is not feasible, security is enforced entirely at the **application layer** using double encryption.

### A. Core Security Design & Mechanics

1. **Zero Cleartext Exposure:**
   * The Master Password is never transmitted over the network under any circumstances.
   * Credential details (usernames, passwords, TOTP keys, notes) are never sent in plaintext.

2. **Double Transit Encryption (AES-GCM 256-bit):**
   * **First Encryption Layer:** The database payload is already fully encrypted client-side using the user's derived Master Key (PBKDF2 SHA-512, 600K iterations).
   * **Second Encryption Layer:** Before transmitting the data over HTTP, the client encrypts the payload *again* using a one-time ephemeral **Transit Key**.

3. **PIN-Based Key Derivation (PBKDF2):**
   * The screen displays a random **6-Digit Pairing PIN** (e.g. `915404`).
   * When pairing, both devices use this 6-Digit PIN as the password seed for a PBKDF2 function.
   * With a cryptographically secure random salt generated on connection, both devices derive the exact same symmetric **Transit Key** locally.

4. **Active Man-in-the-Middle (MITM) Prevention:**
   * Since an eavesdropper on the Wi-Fi network does not know the screen-displayed 6-digit PIN, they cannot decrypt the outer transit layer.
   * **AES-GCM Authenticated Decryption:** Because AES-GCM generates a cryptographically secure authentication tag (GHASH), any attempt by an attacker to alter the transit packets or inject malicious payloads will fail validation. The app will immediately reject the payload and close the socket.

### B. Mobile Network Schemes & Mixed Content Restrictions (Fetch Fixes)

When compiling for Mobile (Capacitor Android), the WebView enforces Chromium-level security rules that can block local sync:
1. **Mixed Content Block:** If the local scheme is `https` (e.g. `https://localhost`), the WebView blocks cleartext HTTP calls (like `http://192.168.1.43:58241`) with a silent `Failed to fetch` error.
2. **Resolution:**
   * Configure `androidScheme: 'http'` in `capacitor.config.ts` to host the web code on `http://localhost`.
   * Enable `cleartext: true` and specify `allowMixedContent: true` inside the Android configuration blocks.
   * Ensure `android:usesCleartextTraffic="true"` is declared inside the `<application>` tag of `AndroidManifest.xml`.

---

## 🚀 8. Next-Stage Update Roadmap & Gaps (v1.2.0 & Beyond)

This section logs identified feature gaps and implementation architectures for the next developer/agent session.

### A. 📱 iOS Native Mobile Target
* **Gap:** Currently only Android is compiled. iOS targets must be configured.
* **Execution Plan:**
  1. Initialize target: Run `npx cap add ios`.
  2. Setup CocoaPods: Configure `ios/App/Podfile` to include local encryption packages.
  3. WebView Security: Configure `Info.plist` with strict App Transport Security (ATS) keys, preventing cleartext connections except to local sync server loopbacks.
  4. Compile using Xcode CLI: `npx cap run ios` or open in Xcode to sign binaries.

### B. 🔌 Chrome/Firefox Extension (System-Wide Autofill Bridge)
* **Gap:** No extension companion to allow direct browser autofilling of active web page forms.
* **Execution Plan:**
  1. **Manifest V3 Core:** Create extension wrapper in `src-extension/` using a background service worker.
  2. **Native Messaging IPC Bridge:** Configure background script to open a Native Messaging channel (Node IPC) with the running Desktop Electron App.
  3. **Dom Injector:** Use Chrome Content Scripts to detect input focus events, request matching domain credentials from the Electron vault via the IPC bridge, and programmatically trigger input events (`input.dispatchEvent(new Event('input'))`).

### C. 🔑 Local Biometric Unlock (Windows Hello & TouchID)
* **Gap:** App must ask for the Master Password on every lock session.
* **Execution Plan:**
  1. **OS Keychain Binding:** Integrate `node-keytar` or `@electron/remote` keytar APIs.
  2. **Master Key Caching:** Upon successful manual unlock, encrypt the derived Master Encryption Key using a secure symmetric token and store it inside the OS Secure Keychain (Credential Manager on Windows / Keychain Access on macOS).
  3. **Biometric Validation:** Trigger local biometric dialogs (e.g. `systemPreferences.canPromptTouchID()`). Upon user fingerprint match, retrieve the cached Master Key to unlock the session instantly.

### D. 🌐 WebAuthn Passkeys (FIDO2 Integration)
* **Gap:** Traditional password manager model. No support for passkeys authentication.
* **Execution Plan:**
  1. **Zero-Knowledge Passkeys Registry:** Utilize modern browser WebAuthn subtle APIs to register the device as a FIDO2 credential provider.
  2. **IndexedDB Passkey Storage:** Store derived public credentials and handle indices locally in IndexedDB under the 'Passkey' category card.

### E. 🔍 Offline Breach Scanning Optimization
* **Gap:** HaveIBeenPwned scanner sends request hashes over the network.
* **Execution Plan:** Add support for downloading partial offline SHA-1 database structures, performing the hash suffix search completely in localized WebWorker scripts.

### F. 📂 [COMPLETED] Automated Backups & Folder Selection Specs
* **Status:** **FULLY IMPLEMENTED** (v1.1.5). Users can configure backup intervals (Every Change, 1 Day, 2 Days, 7 Days), choose format types (Encrypted JSON vs Plaintext CSV), and browse/choose custom local storage directories natively inside Electron.

### G. 🛰️ Bi-directional QR Code Sync (Generator & Scanner on All Clients)
* **Gap:** Currently QR code generation is primarily shown on Desktop, while Mobile acts as the scanner. Sync options must allow any client to act as both server and scanner.
* **Execution Plan:**
  1. **Dual-Role Sync interface:** Redesign the LocalSync UI to feature two explicit action tabs: "Receive Sync" (generates local IP QR code & starts sync server loop) and "Send Sync" (launches QR scanner camera).
  2. **Mobile Sync Server support:** Enable running a lightweight HTTP socket server on mobile apps using Capacitor community socket plugins, allowing a mobile device to host the sync server and display its local IP QR code for another mobile or desktop client to scan and pull.
  3. **Universal Scan Handlers:** Build auto-fallback interfaces where any client type (Desktop, Mobile, or Web client) can dynamically scan sync QR credentials and pair as a receiver.

### H. 🔐 [COMPLETED] Argon2id Key Derivation Integration (v1.2.0 Upgrade)
* **Status:** **FULLY IMPLEMENTED** (v1.2.0). Replaced PBKDF2 KDF with memory-hard Argon2id (Memory: 64MB, Iterations: 3, Parallelism: 4) using highly-optimized WASM runtimes. Added transparent background auto-migration upgrading legacy PBKDF2 databases on first successful login.

### I. 📄 [COMPLETED] Zero-Knowledge Offline Recovery Kit Sheet (v1.2.0)
* **Status:** **FULLY IMPLEMENTED** (v1.2.0). Implemented BIP39 24-word emergency recovery kit. Enforced write-down and verification check step during setup. The derived master key is securely wrapped (AES-GCM encrypted) with the recovery key, enabling instant login restoration path.

### J. 📡 [COMPLETED] Local Subnet Scanner Auto-Discovery (v1.2.0 → v1.4.2 Enhanced)
* **Status:** **FULLY IMPLEMENTED AND ENHANCED** (v1.2.0 initial, v1.4.2 enhancement). Now uses real Electron `os.networkInterfaces()` data via `safevault:get-local-subnets` IPC to build accurate subnet scan list. Fallback to common subnets when running outside Electron.

### K. 🔄 [COMPLETED] Sync Protocol Integrity Overhaul (v1.4.2)
* **Status:** **FULLY IMPLEMENTED** (v1.4.2). Resolved 6 critical sync bugs:
  1. **Ghost Credential Tombstone Tracking** — `deletedCredentialIds[]` stored in `localStorage`, propagated in `SyncPayload`, respected during merge.
  2. **Auto-Discover Dynamic Subnets** — Electron IPC provides real interface subnets.
  3. **Stale Server Credentials** — Server uses `credentialsRef` for always-fresh reads.
  4. **Cloud Relay QR + Auto Channel ID** — One-click random channel generation + live QR display.
  5. **Last Sync Timestamp** — `lastSyncedAt` persisted and shown in Sync Center header.
  6. **Extension defaults to Cloud Relay** — Wi-Fi tab hidden in extension context.

### L. 🔄 [COMPLETED] Double-Layer E2EE Local Sync & Live Auto-Sync (v1.4.3)
* **Status:** **FULLY IMPLEMENTED**. 
  - **Double-Layer E2EE:** Encrypted local vault contents (Layer 1 using Master Vault Key) are wrapped dynamically in transit using PIN-derived keys (Layer 2 via Argon2id) preventing raw transit packet inspection.
  - **Live Auto-Sync:** Debounced automatic push trigger on vault save state mutations.
  - **Universal Role Switching:** Allows Capacitor mobile and browser extensions to act as client senders natively.

### M. 🔑 [COMPLETED] Quick PIN Unlock Security (v1.4.3)
* **Status:** **FULLY IMPLEMENTED**. 
  - **Zero-Knowledge Key Wrapping:** AES-GCM 256-bit encrypts Master Key using PIN key derived locally via Argon2id WASM.
  - **Keypad UI Toggle:** VaultUnlock default rendering switches to PIN mode if configured.
  - **3-Strike Lockout Auto-Wipe:** Auto-deletes wrapped keys on 3 incorrect attempts.

### N. ⚡ Future Sync & Security Improvements (Next Stage Roadmap)
* **Cloud Relay TTL Expiry (Cloudflare Workers):**
  * **Gap:** Pushed encrypted payloads sit on the relay indefinitely — privacy risk.
  * **Execution Plan:** Add `expirationTtl: 86400` (24h) to the Cloudflare Workers KV `put()` call so stale relay data auto-expires.

* **HTTPS Local Sync (Self-Signed TLS):**
  * **Gap:** Local Wi-Fi sync runs over plain `http://`. Metadata (timing, IPs) is visible on the network even though payload is E2EE.
  * **Execution Plan:** Generate a per-session self-signed TLS certificate in the Electron main process using Node's `crypto.generateCertificate`, serve the sync server over HTTPS, and pin the certificate hash inside the QR code for the client to verify.
