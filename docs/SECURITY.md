# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅ Yes    |
| < 1.0   | ❌ No     |

## Reporting a Vulnerability

**⚠️ DO NOT open a public issue for security vulnerabilities.**

SafeVault handles sensitive credential data. Security issues must be reported
privately to prevent exploitation.

### How to Report

1. **Preferred**: Use [GitHub Private Vulnerability Reporting](https://github.com/SudhirDevOps1/SafeVault/security/advisories/new)
2. **Alternative**: Email `security@safevault.local` with subject line `[SECURITY] Brief description`

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)
- Your contact info for follow-up

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Triage**: Within 7 days
- **Fix & Disclosure**: Within 90 days (coordinated with reporter)

We will:
- Confirm the vulnerability and determine severity
- Work with you to understand the issue fully
- Develop and test a fix
- Release a patch
- Publish a security advisory (crediting you if desired)

### What is NOT a Security Issue

- Bugs that don't affect confidentiality/integrity of user data
- UI glitches, performance issues, feature requests
- Issues already reported and being worked on

## Security Best Practices for Users

1. **Use a strong master password** (12+ chars, mixed, symbols)
2. **Never share your master password** — it cannot be recovered
3. **Keep regular encrypted backups** — stored offline if possible
4. **Keep SafeVault updated** — security patches are released promptly
5. **Use 2FA (TOTP)** for high-value accounts stored in SafeVault
6. **Lock your vault** when stepping away (Ctrl+Shift+L)

## Threat Model

SafeVault is designed to protect against:

- ✅ Offline brute-force attacks (via PBKDF2 600K iterations)
- ✅ Device theft (encrypted vault requires master password)
- ✅ Memory inspection (keys wiped on lock)
- ✅ Timing attacks (constant-time compare)
- ✅ Clipboard leakage (auto-clear after 30s)
- ✅ Sleep/hibernate attacks (auto-lock on wake)

SafeVault does **NOT** protect against:

- ❌ Compromised OS / malware with full system access
- ❌ Hardware keyloggers
- ❌ Physical access to unlocked device
- ❌ Master password disclosure by user

---

## 📡 Internet Connectivity Dependencies

SafeVault is designed to be **100% Offline-First**. It only makes network requests in the following specific scenarios (none of which expose your vault data to the cloud):
1. **Security Health Audits (k-Anonymity):** When running a password breach scan, the app queries the HaveIBeenPwned API. To preserve privacy, it only sends the first 5 characters of the SHA-1 hash of your password. Matching and detection happen entirely locally.
2. **GitHub Updates Check:** If enabled in Settings (disabled by default), the app queries the GitHub API on startup to check for newer releases.
3. **Initial App Download:** Downloading the installation packages or loading the web showcase in a browser requires an internet connection.

---

## 🛰️ Local Network Sync Security Model & Limitations

- **Pairing Authentication:** Connections are locked behind a screen-displayed 6-digit PIN.
- **Brute-Force Prevention:** The local sync server enforces an IP-based rate limit of **maximum 3 failed attempts** per IP. Reaching this limit permanently blocks the IP for that sync session.
- **Mixed Content Limitation:** When running the Web App client in a web browser over HTTPS, local browser security models (Mixed Content block) will prevent the client from sending HTTP requests to the local network server. In this scenario, users must use the Desktop or Mobile clients to execute Wi-Fi syncing.

---

Thank you for helping keep SafeVault users safe! 🔐
