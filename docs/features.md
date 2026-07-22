# 🌟 SafeVault features & Roadmap

SafeVault is a premium, offline-first, zero-knowledge credential manager and authenticator. This document provides a visual mapping of the system features, architecture, and the project roadmap.

---

## 🗺️ Architectural Flow

Below is a visual flowchart of how data is securely processed in SafeVault completely offline.

```mermaid
flowchart TD
    A[Master Password Input] --> B(PBKDF2 Key Derivation 600K Iterations)
    B --> C{Verify verificationHash}
    C -- Match --> D[Decrypt Vault in Memory]
    C -- Mismatch --> E[Display Unlock Error]
    D --> F[Zustand Local Store]
    F --> G[Render Dashboard UI]
    G --> H[Clipboard Copy with 30s Wiping]
    G --> I[Secure Export JSON/CSV]
```

---

## 🚀 feature Map

### 1. 🛡️ Hardened Security
* **256-bit AES-GCM Encryption:** Hardware-accelerated local encryption.
* **Anti-Screen Capture:** Desktop window blocks screenshots and screen recording.
* **Clipboard Scrubbing:** Wipes copied data immediately on vault lock.
* **OS-Level Caching Mitigation:** Disables dictionary auto-correct logging on password inputs.

### 2. 🔌 Dynamic Importer & Exporter
* **Universal CSV Importer:** Maps CSV headers from Bitwarden, ProtonPass, Brave, DuckDuckGo, Chrome, Safari, etc.
* **Encrypted Backups:** Export/import using zero-knowledge encrypted JSON files.

### 3. 🎨 Complete Light & Dark Themes
* Dynamic CSS properties mapping that fully changes layouts on theme toggling.

---

## 📈 Release Roadmap

This timeline tracks the features completed in current releases and sets milestones for future development.

```mermaid
gantt
    title SafeVault Project Roadmap
    dateFormat  YYYY-MM-DD
    section Completed
    v1.0.0 Core Cryptography Engine    :done, v1, 2024-01-01, 2024-06-01
    v1.1.0 Security & Universal Import :done, v2, 2026-07-01, 2026-07-22
    section Milestones (Next)
    v1.2.0 Optional Encrypted Cloud Sync  :active, v3, 2026-08-01, 15d
    v1.3.0 Browser Extension Autofill     : v4, 2026-08-15, 30d
    v1.4.0 Mobile App (React Native)      : v5, 2026-09-15, 60d
```

---

## 📂 Documentation Navigator
- [README.md](../README.md) - Main Page
- [CHANGELOG.md](CHANGELOG.md) - Release History
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [SECURITY.md](SECURITY.md) - Responsible Disclosure
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Code of conduct
