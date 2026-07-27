# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2026-07-27

### Fixed — Extension CSP & Sync Critical Bugfixes
- **Chrome Extension CSP Inline Script Bypass:** Replaced `vite-plugin-singlefile` inlining with external code asset compilation compliant with Manifest V3 CSP, resolving blank/black screen issue.
- **Dynamic Popup Sizing:** Added dynamic CSS injection in `src/main.tsx` to lock popup dimensions (`380x550px`) only when running inside Chrome extension context.
- **WebShowcase Layout Bypass:** Updated `VaultSetup.tsx` and `VaultUnlock.tsx` to hide desktop showcase panel inside extension and mobile views, rendering clean centered forms.
- **Local Sync Stack Overflow Fix:** Refactored base64 conversion using safe loop-based `uint8ArrayToBase64`/`base64ToUint8Array` helpers, fixing `atob` crash on large payloads.
- **TypeScript Buffer Source Type Casting:** Fixed `LocalSync.tsx` type errors by casting `iv: resIv as any` and `combined.buffer as ArrayBuffer`.

### Fixed — Sync Protocol Integrity (6 Critical Bugs)
- **Ghost Credential Resurrection (Tombstone Tracking):** Implemented `deletedCredentialIds` tombstone list in `vaultStore.ts`. Deleted credential IDs are now stored and propagated via `SyncPayload` during both Wi-Fi and Cloud Relay sync — preventing deleted passwords from reappearing after sync.
- **Auto-Discover Dynamic Subnets:** `Auto-Discover` now fetches real local network interface subnets from Electron via `safevault:get-local-subnets` IPC, replacing hardcoded guesses. Falls back to common subnets if Electron is unavailable.
- **Server Stale Credentials on Re-sync:** Wi-Fi sync server now reads fresh credentials via `credentialsRef` on every incoming sync request, preventing stale closure state from being merged.
- **Cloud Relay QR Code + Auto Channel ID:** Cloud Relay now auto-generates random Channel IDs (e.g. `vault-a3f7-k9x2`) with one click. A live QR code is shown when both Channel ID and PIN are filled, scannable on the other device to auto-fill fields.
- **Last Sync Timestamp:** `lastSyncedAt` is now persisted to `localStorage` and displayed in the Sync Center header as "Last synced: X minutes ago".
- **Extension Defaults to Cloud Relay:** Browser Extension now opens directly in Cloud Relay mode (no Wi-Fi tab shown) since extensions cannot host a local HTTP server.

### Added
- `SyncPayload` interface in `src/types.ts` wrapping `credentials`, `deletedIds`, and `syncedAt` timestamp for backward-compatible cross-device sync.
- `getSyncPayload()` helper in `vaultStore.ts` to build the sync export object.
- `safevault:get-local-subnets` IPC handler in `electron/main.cjs` and `electron/preload.cjs`.

---

## [1.4.1] - 2026-07-24

### Added — Sync Security Hardening
- **Wi-Fi Sync E2EE Strength Upgrade:** Upgraded transport key derivation function from PBKDF2 (10,000 iterations) to a memory-hard **Argon2id WASM key derivation** (matching the relay-sync security specs).
- **Zero-Sniffing Handshake Authentication:** Replaced plain-text PIN transit (`X-Sync-PIN` header) over local HTTP requests with a cryptographic challenge signature `X-Sync-Hash: SHA-256(PIN + Timestamp)` to prevent network packet sniffers from capturing the raw PIN.
- **Node Sync Server E2EE Bypass:** Refactored the local Node.js sync server (`sync-server.cjs`) to directly route the raw encrypted payload to the React renderer, ensuring decryption/encryption happens entirely inside the sandbox and keeping the main server process zero-knowledge.
- **Relay Worker Spam Protection:** Added `X-Request-Source: SafeVault` origin header checks to the Cloudflare Workers script to restrict KV payload pushes to identified SafeVault clients.

---

## [1.4.0] - 2026-07-24

### Added — Privacy-First Hardening Release
- **Strict Offline Mode (Air-Gap):** New toggle in Settings that globally blocks all outgoing network calls including update checks, breach checks (HaveIBeenPwned), and cloud sync relay requests. When enabled, the vault operates in fully air-gapped mode.
- **Disable Remote Website Icons:** New toggle to prevent favicon loading from external servers (DuckDuckGo CDN). When enabled, credential icons fall back to generated text initials — no external requests made.
- **Privacy Dashboard:** New live status panel in Settings showing real-time status of all privacy protections (Zero-Knowledge, Local Storage, Clipboard, Air-Gap, Favicon, Update Check).
- **Local Audit Log (Session Memory):** SafeVault now logs all sensitive operations in-memory (VAULT_UNLOCKED, CREDENTIAL_ADDED, CREDENTIAL_UPDATED, CREDENTIAL_DELETED, EXPORT_CSV, EXPORT_AUDIT_LOG, HONEYPOT_TRIGGERED). Log is never automatically persisted to disk.
- **Export Audit Log:** New button in Settings to export the in-memory audit log as a local `.json` file for user review.
- **Honeypot / Decoy Credential:** Users can mark any credential with a 🎯 honeypot marker. If the password of a honeypot credential is copied, an animated alert fires and the event is logged to the audit log with timestamp.
- **Lock-on-Tab-Hide (Web/Mobile):** Using the Page Visibility API, the vault now automatically locks when the browser tab or mobile app goes to the background — protecting against shoulder surfing and session hijacking.
- **Lock-on-System-Suspend (Desktop):** Electron `powerMonitor` `suspend` and `lock-screen` events now send a `safevault:lock` IPC message to the renderer, locking the vault when the PC sleeps or the screen is locked.
- **Capacitor App Background Lock (Android):** Added `@capacitor/app` `appStateChange` listener to lock the vault when the Android app goes to the background.
- **Breach Check Gated by Air-Gap:** The "Run Security Audit" (HaveIBeenPwned) button is now blocked when Strict Offline Mode is active, showing a clear explanation.
- **Cloud Relay migration:** Cloud sync relay migrated from proprietary `kvdb.io` to open-source, self-hostable Cloudflare Workers + KV.

### Changed
- Audit instrumentation added to `addCredential`, `updateCredential`, `deleteCredential`, `exportCSV`, `unlockVault` operations.
- `checkLatestRelease` now also returns early if `strictOfflineMode` is active in addition to the `checkForUpdates` flag.
- Version bumped to `1.4.0` across `package.json`, `extension/manifest.json`, and all documentation.

---

## [1.3.0] - 2026-07-24


### Added
- **Zero-Knowledge Cloud Relay E2EE Sync:** Integrated an open-source cloud relay synchronization mechanism using Cloudflare Workers + KV for devices on different networks (e.g. mobile to web, extension to web) without running a local PC server. Data is encrypted using AES-GCM before leaving the device.
- **Forgot Master Password Safety Reset:** Implemented a secure vault reset action inside the unlock interface (`VaultUnlock.tsx`), allowing users to completely wipe their local IndexedDB database and start fresh if they forget their password.

### Changed
- **AES-GCM Local Wi-Fi Sync Transport Encryption:** Upgraded local Wi-Fi sync data transport from plain JSON to fully authenticated AES-GCM-256 E2EE using keys derived from the 6-digit pairing PIN.
- **Clipboard Fallback Auto-Clear:** Patched legacy browser and fallback clipboard environments to ensure clipboard content is physically cleared (overwritten with an empty string) on lock or after 30 seconds.
- Bumped app versions, extension manifest, and documentation to v1.3.0.

## [1.2.0] - 2026-07-24

### Added
- **Argon2id Key Derivation (OWASP 2026):** Upgraded primary credential key derivation from PBKDF2 to memory-hard Argon2id (Memory: 64MB, Iterations: 3, Parallelism: 4).
- **PBKDF2 Silent Auto-Migration:** Implemented seamless auto-migration upgrading legacy PBKDF2 databases to Argon2id upon first successful login.
- **BIP39 24-Word Recovery Phrase Kit:** Integrated 24-word recovery phrase generator and confirmation steps into VaultSetup wizard.
- **Zero-Knowledge Key Wrapping:** Encrypts the master key using the derived recovery key, providing a secure, offline password-reset/recovery bypass option.
- **Local Subnet Sync Auto-Discovery:** Integrated a parallel subnet scanner that probes local networks on port `58241` to auto-discover active peer sync host servers.
- **Update Check Engine Upgrades:** Defaulted auto-update checker to enabled and removed complex session confirmation blocks to show update alerts directly on startup.

### Changed
- **Secure Password Changes:** Upgraded `changeMasterPassword` inside `vaultStore.ts` to derive new database credentials using Argon2id, preventing KDF downgrades, and automatically cleaning stale recovery phrase wraps.
- Bumped app versions, package version strings, and documentation files to v1.2.0.

---

## [1.1.5] - 2026-07-23

### Added
- **Email & Identity Alias Generator (AliasVault Style):** Dynamic generation tool with base email registry, automated URL subdomain extraction, Plus/Dot suffix selectors, and custom domain catch-all configs.
- **Auto-Regenerate on Domain Change:** Tied target website URL handle updates to trigger automatic regeneration of fake profile details and password sequences, ensuring each domain starts with distinct fake details.
- **Individual Copy Controls:** Integrated dedicated 1-click clipboard copy buttons next to First Name, Last Name, Gender, and Birthdate in the fake identity generator panel.
- **DuckDuckGo Icons API Integration:** Replaced the legacy Google s2 favicon service with the anonymous DuckDuckGo Icons API, loading real, high-quality website logos while maintaining offline privacy boundaries.
- **Universal Form Autofill Support:** Wrapped Setup, Unlock, and CredentialForm modals in standard HTML `<form>` tags with submit triggers and correct semantic `autoComplete` attributes (`current-password`, `new-password`, `username`) to support OS-level and third-party password manager autofill systems (e.g. Bitwarden, Proton Pass).
- **Fake Profile Identity Generator:** Auto-generates anonymous profile templates (First/Last Names, Birthdate, Gender, and Usernames) with custom length password sliders.
- **Active Aliases Tracker Card:** Live table view on the Email Aliases panel to display, search, and 1-click copy active stored aliases directly.
- **Real App Launcher Icons:** Auto-generated 74 native adaptive icons, round-icons, and splash-screens from high-res logo source for Android targets.
- **Mobile Platform Support (Capacitor):** Configured Ionic Capacitor targets allowing native Android packaging (.apk generation) from the React codebase.
- **Local Wi-Fi Peer Synchronization:** Added local network sync module to safely synchronize credentials between web, desktop, and mobile clients on the same Wi-Fi using secure HTTP requests.
- **6-Digit Pairing Code Security:** Locked sync sessions behind a screen-displayed 6-digit PIN code to prevent unauthorized network access.
- **Vite & Gradle CI Pipelines:** Configured GitHub Action CI/CD workflows to compile the Android APK dynamically on release pushes.

### Changed
- **Mobile UserAgent Detection:** Patched OS parser branch in Sidebar to prevent mobile browsers from mistakenly identifying as Linux and prompting AppImage downloads.
- **Security Hardening (IP rate-limiting):** Added client IP connection throttling to sync server (max 3 failed PIN attempts before drop-list block).
- **Favicon Fetch Privacy Guard:** Gated external favicon requests behind session network approval and integrated visual initials/Globe icons on loads error.
- Bumped app versions, CLI headers, and store variables to v1.1.5.
- Modified release workflows to overwrite duplicate assets on GitHub.

---

## [1.1.2] - 2026-07-22

### Added
- **Split-Screen Web Showcase Landing:** Created a high-fidelity features showcase panel (Zero-Knowledge, Offline-First, PBKDF2/AES-GCM details) on the left side of Setup & Unlock pages for browser users.
- **Above-the-Fold OS-Detecting Download:** Displayed the auto-detected OS desktop download button prominent and centered directly in the showcase panel, eliminating the need to scroll.

### Changed
- Bumped project package versions, CLI binaries, settings screens, and store variables to v1.1.2.
- Disabled/bypassed the showcase panel inside Electron desktop client to preserve standard centered screen layouts.

---

## [1.1.1] - 2026-07-22

### Added
- **Security Health Audit:** Secure local scanning in settings and CLI (`safevault audit`) checking stored passwords against leaked breach lists using the k-Anonymity privacy protocol.
- **Transient Session Network Consent:** App starts completely offline and blocks all update checks until explicit transient permission is granted via startup banner (consent resets on app reload).
- **Auto-OS Detecting Download Buttons:** Added dynamic Web UI cards on Sidebar, Setup, and Unlock screens to auto-detect client OS and serve direct desktop app download links (Windows, macOS, Linux).

### Changed
- Bumped version configurations to v1.1.1 across desktop packages, CLI binaries, and specifications.

---

## [1.1.0] - 2026-07-22

### Added
- **Universal CSV Importer:** Dynamically parses and imports credentials from Bitwarden, ProtonPass, Brave, DuckDuckGo, Chrome, and 40+ other standard formats.
- **Smart Initials Avatar:** Colored initials fallback avatars for credential logos when website favicons fail to load or are offline.
- **Developer CLI Companion Tool:** Global console tool (`safevault`) featuring case-insensitive fuzzy matching and specific property flags (`-u`, `-p`, `-t`).
- **Optional Update Checker:** Privacy-first optional toggle in Settings to query GitHub Releases API on startup.
- **Unit Tests Expansion:** Introduced comprehensive unit tests specs for `crypto`, `totp`, and `importer` engines using Vitest.

### Fixed
- **Background Process Leak:** App now fully quits and terminates on closing the window, instead of leaving hidden processes running in the background.
- **Auto-Lock Event Churn:** Fixed performance lag/CPU spikes by preventing activity event listeners from constantly re-binding on cursor movements.
- **Dynamic Themes:** Fixed Light/Dark mode toggling and ensured saved theme configurations are correctly applied during app boot.
- **Taskbar Icon:** Corrected resource icon path mapping in Electron window settings, resolving the black square icon bug.

### Security Hardening
- **Anti-Screen Capture:** Implemented window content protection (`setContentProtection(true)`) to block screen sharing, recording, and screenshots of the vault.
- **Clipboard Lock Scrubbing:** System clipboard is now immediately wiped clean of sensitive copied passwords when the vault is locked.
- **Input Caching Mitigation:** Hardened password input fields (`spellCheck={false}`, `autoCorrect="off"`, `autoCapitalize="none"`) to prevent OS-level keyboard caching.

### Changed
- **Windows Setup Installer:** Configured NSIS target in `electron-builder.json` to generate desktop shortcut-enabled installers.

---

## [1.0.0] - 2024-XX-XX

### Added
- **Core Vault**
  - Create encrypted vault with master password
  - AES-GCM 256-bit encryption with PBKDF2 600K iterations
  - Unlock/lock vault with memory wipe on lock
  - Change master password with full re-encryption
- **Credential Management**
  - Add, edit, delete credentials
  - Title, URL, username, password, notes, TOTP secret, category, favorite
  - Search and filter across all fields
  - Copy to clipboard with 30s auto-clear
  - Reveal/hide passwords
- **TOTP 2FA**
  - RFC 6238 compliant TOTP generation
  - Live 6-digit code with countdown ring
  - Base32 secret validation
- **Password Generator**
  - Configurable length (8-64)
  - Character set toggles (uppercase, lowercase, numbers, symbols)
  - Ambiguous character exclusion
  - Strength meter
- **Backup & Export**
  - Encrypted JSON backup export
  - CSV export with plain-text warning
  - Import from encrypted backup
  - Auto-backup to localStorage (optional)
- **Security Hardening**
  - Password strength enforcement (policy validation)
  - Constant-time password comparison
  - System sleep/hibernate detection with auto-lock
  - Auto-lock timer (1/5/15/30 min or never)
  - Secure logger with sensitive data redaction
  - IndexedDB schema migrations support
- **UX & Accessibility**
  - Dark/Light theme with persistence
  - Keyboard shortcuts (Ctrl+Shift+L, Ctrl+N, Ctrl+K, Ctrl+G, /, Esc)
  - Full ARIA labels and roles
  - Loading states for all async operations
  - Responsive mobile layout
  - Privacy policy modal on first launch
- **Electron (Reference)**
  - Secure main.js with contextIsolation
  - contextBridge preload script
  - Anti-debugging in production
  - CSP headers
  - System tray with lock/unlock
  - Code signing configuration
- **Quality & Documentation**
  - Vitest unit tests (crypto, TOTP, password, policy, logger)
  - README.md with full documentation
  - CONTRIBUTING.md
  - CODE_OF_CONDUCT.md
  - SECURITY.md with responsible disclosure
  - MIT License
  - GitHub issue templates (bug, feature, question)
  - GitHub PR template
  - CI/CD workflows (GitHub Actions)
  - Release workflow

### Security
- Zero-knowledge architecture
- 100% offline operation
- No telemetry or analytics
- Master password never stored
- Encrypted key derivation with 600K PBKDF2 iterations
- Clipboard auto-clearing

[1.1.5]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.1.5
[1.1.2]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.1.2
[1.1.1]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.1.1
[1.1.0]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.1.0
[1.0.0]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.0.0
