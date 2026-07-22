# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/SudhirDevOps1/SafeVault/releases/tag/v1.0.0
