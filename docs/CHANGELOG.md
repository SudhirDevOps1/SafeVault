# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [1.1.1] - 2026-07-22

### Added
- **Security Health Audit:** Secure local scanning in settings and CLI (`safevault audit`) checking stored passwords against leaked breach lists using the k-Anonymity privacy protocol.
- **Transient Session Network Consent:** App starts completely offline and blocks all update checks until explicit transient permission is granted via startup banner (consent resets on app reload).

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

[1.1.1]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.1.1
[1.1.0]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.1.0
[1.0.0]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.0.0
