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

## ✨ Key Features & Cryptographic Architecture

SafeVault is engineered with zero-trust principles. Below is the structured breakdown of our core capabilities:

<table>
  <thead>
    <tr>
      <th width="33%">🔒 Security Hardening</th>
      <th width="33%">⚙️ Full Feature Set</th>
      <th width="33%">🌐 Privacy & Localism</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td valign="top">
        <ul>
          <li><b>AES-GCM 256-bit</b> encryption via Web Crypto API.</li>
          <li><b>PBKDF2 key derivation</b> with 600,000 iterations + SHA-512.</li>
          <li><b>Zero-Knowledge:</b> Master password never stored or transmitted.</li>
          <li><b>Screenshot Blocking:</b> Prevent screen captures on desktop.</li>
          <li><b>Clipboard Scrubbing:</b> Auto-clear copies after 30s.</li>
          <li><b>Constant-Time Comparison</b> to block timing attacks.</li>
        </ul>
      </td>
      <td valign="top">
        <ul>
          <li><b>TOTP 2FA Authenticator:</b> Live codes with countdown timer.</li>
          <li><b>Universal CSV Importer:</b> 40+ password managers supported.</li>
          <li><b>Security Audit Scanner:</b> k-Anonymity local leak checks.</li>
          <li><b>Fuzzy CLI Tool:</b> Complete terminal credential manager companion.</li>
          <li><b>Smart Logos:</b> Initials logo fallbacks when offline.</li>
          <li><b>Theme Engine:</b> Fully functional light/dark modes.</li>
        </ul>
      </td>
      <td valign="top">
        <ul>
          <li><b>100% Offline-First:</b> No central servers or cloud db syncs.</li>
          <li><b>No Telemetry:</b> Zero analytics, user tracking, or call homes.</li>
          <li><b>IndexedDB Sandbox:</b> Local local-first browser storage.</li>
          <li><b>Transient Network Consent:</b> Startup toggle for optional updates.</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

---

## 🛡️ Security Architecture & Privacy Policy

> [!IMPORTANT]
> **Zero-Knowledge Principle:** All cryptographic processes occur locally. Your master password is used solely to derive your local encryption key and is never written to disk or sent across any network.

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

### 🚫 Non-Negotiable Network Rules:
* ❌ **No Telemetry/Analytics:** SafeVault never collects usage statistics or diagnostic data.
* ❌ **Zero Server Calls:** All credentials remain offline. No cloud syncing or external database calls.
* ❌ **No Third-Party CDNs:** Fonts, icons, and libraries are locally bundled in the distribution.
* ❌ **Secure audits:** Breach audits use `k-Anonymity` matching, sending only the first 5 chars of a SHA-1 hash (never full passwords/hashes).

---

## 🚀 Installation & Downloads

### Official Pre-built Binaries (v1.1.2)

Download the latest release files directly from the [GitHub Releases Page](https://github.com/SudhirDevOps1/SafeVault/releases/latest).

#### 🪟 Windows (Windows 10/11)
- **Installer (Recommended):** Download `SafeVault Setup 1.1.2.exe`. Double-click to install. This automatically registers start menu entries, desktop shortcuts, and links the application icons.
- **Portable Version:** Download `SafeVault 1.1.2.exe`. A single standalone binary that runs instantly without installation (useful for USB drives).

#### 🍎 macOS (Apple Silicon M1/M2/M3)
- **DMG Installer:** Download `SafeVault-1.1.2-arm64.dmg`. Double-click to open, and drag **SafeVault** to your `Applications` folder.
- **ZIP Archive:** Download `SafeVault-1.1.2-arm64-mac.zip`. Unpack and run the application directly.
*Note: If macOS blocks launch with a "Developer cannot be verified" warning, right-click the app, select **Open**, and confirm.*

#### 🐧 Linux (Ubuntu, Debian, Fedora, Arch, etc.)
- **AppImage:** Download `SafeVault-1.1.2.AppImage`. Run the following command in your terminal to make it executable and launch:
  ```bash
  chmod +x SafeVault-1.1.2.AppImage
  ./SafeVault-1.1.2.AppImage
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
