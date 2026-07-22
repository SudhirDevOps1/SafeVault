# 💻 SafeVault CLI Installation & Usage Guide

SafeVault includes a lightweight, secure, offline-first Command Line Interface (CLI) tool. This guide explains how to install it globally, how it integrates with the desktop app, and how to use all commands from any terminal directory.

---

## ⚙️ How to Install & Run Globally

To run the `safevault` command from any directory on your computer, follow the instructions below:

### 1. Developer Mode (Via Node.js)
If you have Node.js installed, you can link the CLI tool globally:
1. Open your terminal in the SafeVault project root directory:
   ```bash
   npm install
   npm link
   ```
2. Now, you can use the `safevault` command anywhere in your terminal!

### 2. Desktop Installer Integration (Windows / NSIS)
When you build the production app using `npm run electron:build`, the installer copies the CLI files into the application directory.
* During installation, ensure the installation directory is added to your system **PATH** environment variable.
* A convenience batch runner `safevault.cmd` is provided in the installation root, allowing you to call `safevault` from any Command Prompt or PowerShell window.

---

## 🛠️ Commands & Usage Examples

### 1. Initialize the Vault
Create a new secure local database (`~/.safevault.db`) with a Master Password:
```bash
safevault init
```
* **Security Note:** The CLI derives a key locally using PBKDF2 with 600,000 iterations + SHA-512. It never stores your master password on disk.

### 2. List Credentials
List all stored titles and usernames:
```bash
safevault list
```

### 3. Add a New Credential
Add an entry interactively:
```bash
safevault add
```
* **Prompts:** Title, Username, Password, URL, Notes, and optional TOTP secret.

### 4. Fetch Credentials (with Options)
Retrieve stored entries using case-insensitive fuzzy matching:
```bash
# Print full details and copy password to clipboard
safevault get google

# Print ONLY the username (great for shell scripting)
safevault get google -u

# Copy the password directly to the clipboard (auto-wipes in 15 seconds)
safevault get google -p

# Generate and print the live 6-digit TOTP 2FA code
safevault get google -t
```

### 5. Security health Audit (k-Anonymity)
Check all stored passwords against public data breach registries privately:
```bash
safevault audit
```
* **Privacy Assurance:** SafeVault uses the secure k-Anonymity protocol. Only the first 5 characters of your password's SHA-1 hash are sent to the check registry. The actual password never leaves your device.

### 6. Export / Import Backups
Interoperate seamlessly with the desktop GUI by importing/exporting encrypted JSON backups:
```bash
# Export CLI data to a GUI-compatible encrypted file
safevault export my-backup.json

# Import GUI-exported encrypted backup file to CLI
safevault import my-backup.json
```

---

## 📂 Documentation Navigator
- [README.md](../README.md) - Main Page
- [CHANGELOG.md](CHANGELOG.md) - Release History
- [features.md](features.md) - Architectural Details
- [SECURITY.md](SECURITY.md) - Vulnerability Reporting
