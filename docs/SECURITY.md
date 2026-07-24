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

- ✅ Offline brute-force attacks (via Argon2id WASM key derivation & PBKDF2 600K iterations)
- ✅ Device theft (encrypted vault requires master password)
- ✅ Memory inspection (keys wiped on lock)
- ✅ Timing attacks (constant-time compare)
- ✅ Clipboard leakage (auto-clear after 30s)
- ✅ Sleep/hibernate attacks (auto-lock on wake)
- ✅ Wi-Fi sync sniffing attacks (E2EE derived via Argon2id + HMAC signatures)
- ✅ Relay server privacy breach (Zero-knowledge design ensures data is encrypted client-side before transit)

SafeVault does **NOT** protect against:

- ❌ Compromised OS / malware with full system access
- ❌ Hardware keyloggers
- ❌ Physical access to unlocked device
- ❌ Master password disclosure by user

---

## 📡 Internet Connectivity Dependencies & Zero-Telemetry Model

SafeVault is **100% Free, Open-Source, and Zero-Telemetry**. It collects absolutely no user analytics, crash logs, diagnostic pings, or usage metadata. 

External network requests are strictly gated and initiated **ONLY** in the following scenarios (all of which require explicit transient user permission):
1. **Security Health Audits (k-Anonymity):** When running a password breach scan, the app queries the HaveIBeenPwned API. To preserve privacy, it only sends the first 5 characters of the SHA-1 hash of your password. Matching and detection happen entirely locally.
2. **Website Favicon Loading:** High-quality website logos are fetched via the anonymous DuckDuckGo Icons API (`https://icons.duckduckgo.com/ip3/domain.ico`). SafeVault sends only the parsed website hostname (e.g. `icedrive.net`), never your login credentials or usernames.
3. **GitHub Updates Check:** If enabled in Settings (disabled by default), the app queries the GitHub API on startup to check for newer releases.
4. **Initial App Download:** Downloading the installation packages or loading the web showcase in a browser requires an internet connection.

---

## 🛰️ Local Network Sync Security Model & Limitations

- **Pairing Authentication (HMAC Challenge):** Connections are authorized using a screen-displayed 6-digit PIN. To prevent sniffing of the PIN over LAN HTTP, the client hashes the PIN with a timestamp nonce (`SHA-256(PIN + Timestamp)`) and sends the hash. The server validates this in constant-time, preventing timing attacks and network replay snooping.
- **E2EE Transport Strength:** Sync payload transport keys are derived using memory-hard **Argon2id** (matching the vault KDF standard) rather than weak key derivation functions.
- **Zero-Knowledge Node Server:** The local HTTP host (`sync-server.cjs`) only routes the opaque payload; the credentials are decrypted/merged exclusively within the renderer sandboxes (React application process), keeping the server backend zero-knowledge.
- **Subnet Restriction:** Local sync operates entirely over peer-to-peer Wi-Fi networks. It cannot cross the WAN/Internet and both devices must share the same local network subnet.
- **Brute-Force Prevention:** The local sync server enforces an IP-based rate limit of **maximum 3 failed attempts** per IP. Reaching this limit permanently blocks the IP for that sync session.
- **Mixed Content Limitation:** When running the Web App client in a web browser over HTTPS, local browser security models (Mixed Content block) will prevent the client from sending HTTP requests to the local network server. In this scenario, users must use the Desktop or Mobile clients to execute Wi-Fi syncing.

---

Thank you for helping keep SafeVault users safe! 🔐
