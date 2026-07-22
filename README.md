<div align="center">

<img src="public/images/safevault-logo.png" alt="SafeVault Logo" width="160" height="160" />

# 🔐 SafeVault

### Zero-Knowledge, Offline-First Credential Manager

**Your passwords. Your device. Your control. Nothing leaves your machine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/SudhirDevOps1/SafeVault/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-30+-blue)](https://www.electronjs.org/)

[Features & Roadmap](docs/features.md) • [CLI Guide](docs/cli-guide.md) • [Changelog](docs/CHANGELOG.md) • [Security](docs/SECURITY.md) • [Contributing](docs/CONTRIBUTING.md) • [Installation](#-installation--downloads)

---

## 📸 App Showcase

Here is how the SafeVault application looks when running on a web browser:

<table width="100%">
  <tr>
    <td width="50%" align="center" valign="top">
      <b>1. Zero-Knowledge Split Landing Screen</b><br/>
      <p style="font-size: 12px; color: #888;">Split layout featuring auto-detected OS desktop download options next to the forms.</p>
      <img src="docs/screenshots/split_showcase.png" alt="SafeVault Split Landing Showcase" width="100%" />
    </td>
    <td width="50%" align="center" valign="top">
      <b>2. Main Dashboard & Active TOTP 2FA</b><br/>
      <p style="font-size: 12px; color: #888;">Primary vault view with categories, quick searches, and dynamic desktop download sidebar card.</p>
      <img src="docs/screenshots/dashboard.png" alt="SafeVault Main Dashboard" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <b>3. Add New Credential Form</b><br/>
      <p style="font-size: 12px; color: #888;">Standard modal to save credential records with custom category and TOTP keys.</p>
      <img src="docs/screenshots/add_credential.png" alt="SafeVault Add Credential Form" width="100%" />
    </td>
    <td width="50%" align="center" valign="top">
      <b>4. Credential Detail & Decryption View</b><br/>
      <p style="font-size: 12px; color: #888;">Hidden password decryption view, copy helpers, and live 2FA countdown meters.</p>
      <img src="docs/screenshots/credential_details.png" alt="SafeVault Credential Details View" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <b>5. Security Settings & Theme Toggles</b><br/>
      <p style="font-size: 12px; color: #888;">Statistics dashboards, Light/Dark styling preferences, auto-lock sliders, and backups.</p>
      <img src="docs/screenshots/settings.png" alt="SafeVault Security Settings" width="100%" />
    </td>
    <td width="50%" align="center" valign="top">
      <b>6. Configurable Password Generator</b><br/>
      <p style="font-size: 12px; color: #888;">High-entropy cryptographically secure string generator with character filter selections.</p>
      <img src="docs/screenshots/password_generator.png" alt="SafeVault Password Generator" width="100%" />
    </td>
  </tr>
</table>

---

## ✨ Features

### 🔒 Security First
- **AES-GCM 256-bit** encryption via Web Crypto API
- **PBKDF2** with 600,000 iterations + SHA-512 for key derivation
- **Zero-Knowledge** architecture — master password never stored
- **Constant-time comparison** to prevent timing attacks
- **Auto-lock** on inactivity + system sleep/hibernate detection
- **Clipboard auto-clear** after 30 seconds
- **Anti-debugging** in production builds
- **Anti-Screen Capture / Screenshot Blocking** (`setContentProtection(true)`) in desktop builds

### 📱 Full Feature Set
- Store credentials with title, URL, username, password, notes, TOTP secret
- **TOTP 2FA** with live 6-digit codes & countdown timer
- **Secure password generator** (configurable length, charsets, ambiguous exclusion)
- **Categories** and **favorites**
- **Search & filter** across all fields
- **Encrypted backups** (.json) and CSV export (with warning)
- **Universal CSV Importer** supporting Bitwarden, ProtonPass, Brave, DuckDuckGo, Chrome, and 40+ formats
- **Smart Initials Avatar Fallback** for offline website logos/favicons
- **Security Health Audit** local scanner checking passwords against data breaches using k-Anonymity privacy protocols
- **Developer CLI Companion Tool** featuring fuzzy searches, clipboard wiping, and field extraction flags
- **Master password change** with full re-encryption
- **Dark/Light theme** (fully functional & persisted)
- **Keyboard shortcuts** (Ctrl+Shift+L, Ctrl+N, Ctrl+K, etc.)
- **Accessibility** (ARIA labels, keyboard navigation, screen reader support)

### 🌐 Privacy & Network Control
- **Offline-First:** Runs entirely locally. No telemetry, analytics, or background tracking.
- **Strict Permission Prompts:** Network access for optional features (checking updates, k-Anonymity security audits) is strictly blocked by default. The application prompts for permission every time it starts (non-persistent transient session consent).
- **Local Storage:** Vault databases are stored locally via IndexedDB (Dexie).

---

## 🛡️ Security Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Master Password                  │
└──────────────────┬──────────────────────────────────┘
                   │ PBKDF2 (600K iterations, SHA-512)
                   ▼
┌─────────────────────────────────────────────────────┐
│              Encryption Key (256-bit)               │
└──────────────────┬──────────────────────────────────┘
                   │ AES-GCM + random IV (12 bytes)
                   ▼
┌─────────────────────────────────────────────────────┐
│        Encrypted Vault (IndexedDB, local only)      │
└─────────────────────────────────────────────────────┘
```

**What SafeVault does NOT do:**
- ❌ Send any data over the network
- ❌ Store your master password (only a verification hash)
- ❌ Collect telemetry or analytics
- ❌ Load external resources (CDN, fonts, etc.)
- ❌ Allow remote access to your data

---

## 🚀 Installation & Downloads

### Official Pre-built Binaries (v1.1.0)

Download the latest release files directly from the [GitHub Releases Page](https://github.com/SudhirDevOps1/SafeVault/releases/latest).

#### 🪟 Windows (Windows 10/11)
- **Installer (Recommended):** Download `SafeVault.Setup.1.1.0.exe`. Double-click to install. This automatically registers start menu entries, desktop shortcuts, and links the application icons.
- **Portable Version:** Download `SafeVault.1.1.0.exe`. A single standalone binary that runs instantly without installation (useful for USB drives).

#### 🍎 macOS (Apple Silicon M1/M2/M3)
- **DMG Installer:** Download `SafeVault-1.1.0-arm64.dmg`. Double-click to open, and drag **SafeVault** to your `Applications` folder.
- **ZIP Archive:** Download `SafeVault-1.1.0-arm64-mac.zip`. Unpack and run the application directly.
*Note: If macOS blocks launch with a "Developer cannot be verified" warning, right-click the app, select **Open**, and confirm.*

#### 🐧 Linux (Ubuntu, Debian, Fedora, Arch, etc.)
- **AppImage:** Download `SafeVault.1.1.0.AppImage`. Run the following command in your terminal to make it executable and launch:
  ```bash
  chmod +x SafeVault.1.1.0.AppImage
  ./SafeVault.1.1.0.AppImage
  ```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/SudhirDevOps1/SafeVault.git
cd SafeVault

# Install dependencies
npm install

# Development mode (web)
npm run dev

# Build for production
npm run build

# Build Electron desktop app (requires electron deps)
npm run electron:build
```

---

## 📖 Usage

### First Launch
1. Launch SafeVault
2. Review the Privacy Policy
3. Create a strong master password (enforced: 8+ chars, mixed case, numbers, symbols)
4. Your vault is ready

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Lock vault (works even while typing) |
| `Ctrl+N` | New credential |
| `Ctrl+K` | Focus search |
| `Ctrl+G` | Open password generator |
| `/` | Show all shortcuts |
| `Esc` | Close modal / deselect |

### Backup & Restore
- **Export** encrypted backup: Settings → Export Encrypted Backup
- **Import** from backup: Login screen → Import from Backup
- **Auto-backup**: Enable in Settings (saves to localStorage)

---

## 🛠️ Development

### Prerequisites
- Node.js 20+
- npm 10+

### Scripts

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests (Vitest)
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report
npm run lint         # Lint code
npm run typecheck    # TypeScript check
```

### Project Structure

```
SafeVault/
├── src/
│   ├── components/       # React UI components
│   ├── hooks/            # Custom hooks (auto-lock, shortcuts, etc.)
│   ├── stores/           # Zustand state management
│   ├── utils/            # Crypto, TOTP, password gen, logger, DB
│   ├── test/             # Test setup
│   ├── App.tsx           # Entry point
│   └── main.tsx          # React mount
├── electron/
│   ├── main.js           # Electron main process (hardened)
│   └── preload.js        # contextBridge secure IPC
├── public/
├── .github/              # GitHub templates & CI/CD
├── electron-builder.json # Electron build config
├── vitest.config.ts      # Test config
└── README.md
```

---

## 🧪 Testing

```bash
npm test
```

Test suites cover:
- ✅ Cryptographic functions (encryption, key derivation, constant-time compare)
- ✅ TOTP generation (RFC 6238 compliance)
- ✅ Password generator (charset selection, entropy)
- ✅ Password policy enforcement
- ✅ Secure logger (sensitive data redaction)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start
1. Fork the repo
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [React](https://react.dev/) - UI framework
- [Vite](https://vite.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Dexie](https://dexie.org/) - IndexedDB wrapper
- [Lucide](https://lucide.dev/) - Icons
- [Electron](https://www.electronjs.org/) - Desktop framework

---

## 📞 Support

- 📖 [Documentation](https://github.com/SudhirDevOps1/SafeVault/wiki)
- 🐛 [Report a bug](https://github.com/SudhirDevOps1/SafeVault/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/SudhirDevOps1/SafeVault/issues/new?template=feature_request.md)
- 🔒 [Report security issue](docs/SECURITY.md)

---

<div align="center">

**Built with 🔐 by [SudhirDevOps1](https://github.com/SudhirDevOps1)**

_Your privacy is not optional. It's the default._

</div>
