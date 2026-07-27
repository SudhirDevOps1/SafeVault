## SafeVault v2.0.0 - CLI Overhaul and Launcher Stability

### New Features - CLI
- safevault edit: Edit any existing credential entry
- safevault remove: Delete a credential with confirmation
- safevault generate: Generate cryptographically strong passwords
- safevault change-password: Re-encrypt vault with new master password
- Password strength checker on add, init, change-password
- Duplicate password detection in audit
- TOTP seconds remaining shown next to 2FA code
- Interactive numbered selection for multi-match results
- TTY-aware ANSI colors, vault saved with 0600 permissions

### Bug Fixes - CLI
- Fixed broken password masking (raw mode + backspace support)
- Added missing password confirmation on init
- Fixed import to support both backup formats
- Centralized authenticate helper, proper exit codes

### New Features - Setup Launcher
- All options 1-7 open in separate CMD windows - launcher never closes
- Replaced set/p with choice command - immune to stdin consumption
- Added nul redirect on all npm calls to prevent stdin theft

### Bug Fixes - Setup Launcher
- Fixed infinite loop from npm install consuming stdin
- Fixed auto-exit after any menu option selection
- Fixed parenthesis nesting crash in if blocks
- Fixed chcp byte-offset shift bug
- Fixed title ampersand split crash
- Fixed npm link EEXIST error with --force flag

### Version Sync
- Bumped to 2.0.0 across package.json, extension/manifest.json, Settings.tsx, Sidebar.tsx, WebShowcase.tsx, vaultStore.ts
