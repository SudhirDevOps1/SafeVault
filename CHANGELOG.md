# Changelog

## [0.4.0](https://github.com/SudhirDevOps1/SafeVault/compare/v0.3.0...v0.4.0) (2026-10-15)


### Features

* omni-platform update detection, 1-click installer, and zero-data-loss migration ([fa9b4f7](https://github.com/SudhirDevOps1/SafeVault/commit/fa9b4f7df4303d844a7b1f4f808569632b4fbdf4))
* **ui:** redesign credential detail with Proton Pass style UI, prominent Edit button, real logos and custom icon/color picker ([c9dfc28](https://github.com/SudhirDevOps1/SafeVault/commit/c9dfc2848d16ddfa2c7f331edcfc963b72e7f3fb))


### Bug Fixes

* **extension:** resolve extension context invalidated error and reinforce autofill synchronization ([2ebb810](https://github.com/SudhirDevOps1/SafeVault/commit/2ebb810c02b0e1e7abaa62e2c0e27f7268232efb))
* **extension:** resolve unhandled promise rejection and safely handle clipboard and extension messaging ([8ee79b1](https://github.com/SudhirDevOps1/SafeVault/commit/8ee79b18ea4adb0cdfa62ec273794b4fb485bcef))

## [0.3.0](https://github.com/SudhirDevOps1/SafeVault/compare/v0.2.1...v0.3.0) (2026-10-15)


### Features

* complete autofill settings panel, clean website alias matching, and 2FA in-field support ([8c8a2b4](https://github.com/SudhirDevOps1/SafeVault/commit/8c8a2b4a73aea8ccf79139d50f602fe3964198ed))
* integrate Proton Authenticator hub, smart multi-field autofill, live 2FA auto-copy, and tab state sync ([e4e7625](https://github.com/SudhirDevOps1/SafeVault/commit/e4e7625cdd90cf4954b4cd061b2d9feab6f9fd32))
* smart command palette, universal mobile bottom nav, responsive layout polish, and resolve GitHub CodeQL alerts ([48cdf97](https://github.com/SudhirDevOps1/SafeVault/commit/48cdf978516f57c63e35ad1cc33627fc082db99a))
* unlimited clean website email aliases, emergency kit, decoy pin, and unified v0.3.0 ([8457620](https://github.com/SudhirDevOps1/SafeVault/commit/84576207ee43ec80126d528a364d3e0afd7d9b24))

## [0.2.1](https://github.com/SudhirDevOps1/SafeVault/compare/v0.2.0...v0.2.1) (2026-10-14)


### Bug Fixes

* **extension:** guarantee character diversity in password generator to eliminate test flakiness ([d1f88d6](https://github.com/SudhirDevOps1/SafeVault/commit/d1f88d63333296ef1ef584857e8abf6101955cfc))

## [0.2.0](https://github.com/SudhirDevOps1/SafeVault/compare/v0.1.0...v0.2.0) (2026-10-14)


### Features

* add automated setup-and-run.bat script for one-click installation and startup ([e6d3d58](https://github.com/SudhirDevOps1/SafeVault/commit/e6d3d5813816c4a7b2f847d29a4f901e18cfcd9b))
* add CodeQL CI/CD, local E2E test suite, security scanner, and enhanced extension autofill ([e8060d0](https://github.com/SudhirDevOps1/SafeVault/commit/e8060d07e25493cc761c8956cd4149bcadae5403))
* add desktop app download links to web app (Sidebar, Unlock, Setup screens) when running on browser mode ([08a54a4](https://github.com/SudhirDevOps1/SafeVault/commit/08a54a42e86134bcd5692418d1779907b562da31))
* add electron:dev script to package.json ([3d83d3f](https://github.com/SudhirDevOps1/SafeVault/commit/3d83d3fe2dd4c771c23c25b65d8141de754523f3))
* add open-source Cloudflare Worker relay-worker script ([78572a9](https://github.com/SudhirDevOps1/SafeVault/commit/78572a9bd029e9ccbd8594bbbc72cee14875feb6))
* add optional recovery and kdf type fields to VaultRecord interface ([17d74f0](https://github.com/SudhirDevOps1/SafeVault/commit/17d74f0d7cb1f45ac161d700633845aa6070d068))
* **audit:** add local security audit page and cli command using secure k-Anonymity protocol ([9c03f24](https://github.com/SudhirDevOps1/SafeVault/commit/9c03f247592a6f04504f6c08d5f88c5df1ec026b))
* auto-regenerate fake profile details on website URL change, add individual copy buttons, and switch to DuckDuckGo favicon service ([3f4418a](https://github.com/SudhirDevOps1/SafeVault/commit/3f4418af53a2111b3102ce9bb5798302909624c7))
* **cli:** add case-insensitive fuzzy matching and property flags (-u, -p, -t) to get command ([e32974f](https://github.com/SudhirDevOps1/SafeVault/commit/e32974f1792f5d8640e7054b76226b3f82b3647d))
* **cli:** add interactive terminal menu wizard with premium ASCII art logo ([b42414e](https://github.com/SudhirDevOps1/SafeVault/commit/b42414e75e3a816573a21361488d22bddb290168))
* **cli:** add standalone Node.js CLI tool with full E2E WebCrypto compatibility ([ff30bd7](https://github.com/SudhirDevOps1/SafeVault/commit/ff30bd72b1177f85c6c2dc8a87c2afd3ee5cfcb8))
* **cli:** enhance CLI help menu with detailed styled ANSI examples and privacy spec explanation ([75aa10f](https://github.com/SudhirDevOps1/SafeVault/commit/75aa10f7923025257aed70952c723fb480ee408a))
* **cli:** major v2.0.0 overhaul - add edit/remove/generate/change-password commands, fix password masking, centralize auth, add strength checker and duplicate detection ([4afb3dd](https://github.com/SudhirDevOps1/SafeVault/commit/4afb3ddfe139f0efc54866db047a18274a1ec0b3))
* **cli:** prompt to automatically initialize vault if no database is found during list, add, get, or audit ([5fe8016](https://github.com/SudhirDevOps1/SafeVault/commit/5fe8016bc347d60a9e256d3de8c03f792772455d))
* complete typechecks and cast fixes for key wrapping and recovery phrase unlock ([4fd85e1](https://github.com/SudhirDevOps1/SafeVault/commit/4fd85e15749679dad0b32de7923719798bc4099d))
* design premium active aliases list, set 'Alias' category, and style list item badges in vault UI ([ded9581](https://github.com/SudhirDevOps1/SafeVault/commit/ded95810e20c5870d43b4b399a318da41aa8d71b))
* implement 'Copy All Profile Details' multi-clipboard helper in Email Alias Generator ([dfc5fb0](https://github.com/SudhirDevOps1/SafeVault/commit/dfc5fb0e268caab4bd64f119fa3961d7b69fe84c))
* implement advanced auto-backup configuration with formats, intervals, and custom directory selection ([c82f33a](https://github.com/SudhirDevOps1/SafeVault/commit/c82f33a294ccbb47435d8bf9e287519f5fc782b4))
* implement Argon2id and Recovery Key KDF algorithms in utils/crypto.ts ([29dae06](https://github.com/SudhirDevOps1/SafeVault/commit/29dae06bbccaa8631286cf26fbafd4e6958edd9b))
* implement automatic OS detection to offer direct desktop app download links ([478331d](https://github.com/SudhirDevOps1/SafeVault/commit/478331daa313858857f748d8c1439912151dec5b))
* implement BIP39 recovery wordlist and generators ([48502d2](https://github.com/SudhirDevOps1/SafeVault/commit/48502d2fb4c946276c0fd9cb53c836204a633250))
* implement Forgot Master Password Reset Vault action in VaultUnlock.tsx ([1890605](https://github.com/SudhirDevOps1/SafeVault/commit/1890605435745228af3fb590d827486047087cca))
* implement key wrapping and unwrapping for recovery key mapping ([c52ae3d](https://github.com/SudhirDevOps1/SafeVault/commit/c52ae3d91cf3de847210eaec820b23df47f389b7))
* implement native Email Alias Generator (AliasVault style) with base email registry, domain parsing, and vault integrations ([dd7eaea](https://github.com/SudhirDevOps1/SafeVault/commit/dd7eaea51e11721056e4edd08f3b5e822fa10de1))
* implement one-click background updates with release notes modal on desktop and web clients ([887bcc7](https://github.com/SudhirDevOps1/SafeVault/commit/887bcc736b4c40f3b29cb255171a3dbd31e8efc3))
* implement Recovery Mnemonic unlock interface in VaultUnlock.tsx ([2ee9a1b](https://github.com/SudhirDevOps1/SafeVault/commit/2ee9a1b056c0114fa46dd992d5755ec60edf8175))
* implement secure local Wi-Fi peer synchronization with 6-digit PIN verification ([deeec85](https://github.com/SudhirDevOps1/SafeVault/commit/deeec85b44386bce06d7d81eebfc94b00d32fe57))
* implement split-screen web showcase and bump app version to v1.1.2 ([bb1f2d4](https://github.com/SudhirDevOps1/SafeVault/commit/bb1f2d491e9a22743b7cb1a961bdea97afb91d95))
* implement Wi-Fi Subnet Auto-Discovery scanner button in LocalSync.tsx ([3739163](https://github.com/SudhirDevOps1/SafeVault/commit/373916387c9f9fe5e4b98fe05aaa8f9a6aa4cf4e))
* implement Zero-Knowledge Cloud Relay E2EE sync panel in LocalSync.tsx UI ([346cef0](https://github.com/SudhirDevOps1/SafeVault/commit/346cef0b3b37054d07355b57a2aead6427223327))
* **importer:** add universal CSV importer, initials avatar fallback, functional light theme, relative icon path mapping, and nsis installer support ([7a1e8bc](https://github.com/SudhirDevOps1/SafeVault/commit/7a1e8bc1e1154e5d416731809e7f75b589929579))
* initialize Release Please automation, reset version to 0.1.0 for beta, and fix CodeQL security alerts ([81abd32](https://github.com/SudhirDevOps1/SafeVault/commit/81abd32124d4696a543b60e650070144f6fab238))
* integrate Argon2id and recovery key wrapping in vaultStore ([9608305](https://github.com/SudhirDevOps1/SafeVault/commit/9608305c734c304ac2d428d5fed6a3879fab26bd))
* integrate Ionic Capacitor to add Android mobile app build target alongside Web and Electron ([94756f2](https://github.com/SudhirDevOps1/SafeVault/commit/94756f2a4bd778d4e5dafecded20c1ee1859fcc4))
* integrate Manifest V3 Web Extension support framework ([53bff9b](https://github.com/SudhirDevOps1/SafeVault/commit/53bff9b13a5c8ce43f107382693161474833806c))
* integrate offline QR code pairing, camera scanner client, and firewall troubleshooting guide ([8d4a7d1](https://github.com/SudhirDevOps1/SafeVault/commit/8d4a7d1150db38a75d9b698d28f5d0d5d18d3d9f))
* migrate cloud sync relay from kvdb.io to open-source Cloudflare Workers + KV, and update documentation ([231ad1c](https://github.com/SudhirDevOps1/SafeVault/commit/231ad1ce66c48d16ef368440968b0d0c3df3dc9e))
* release v3.0.0 (Smart Importer, Cards, Health, E2EE Share, Passkeys, Autofill, and PIN fix) ([d11449e](https://github.com/SudhirDevOps1/SafeVault/commit/d11449e27befb416469cdbd337ccaa4a74b5752c))
* resolve mobile UA detection, implement fake identity profile generators with custom password lengths, and update gitignore rules ([89cec95](https://github.com/SudhirDevOps1/SafeVault/commit/89cec958e2d93cae21aa7504d10d0b594355a7dd))
* **security:** implement secure Quick PIN unlock utilizing Argon2id and AES-GCM Key Wrapping with 3-strike lockout database wipe protection ([683f96a](https://github.com/SudhirDevOps1/SafeVault/commit/683f96a16933a820f47f4463a40d02f91960e659))
* **setup:** replace setup-and-run.bat with advanced self-healing unicode/ansi edition ([73ae8fb](https://github.com/SudhirDevOps1/SafeVault/commit/73ae8fb947bc067b55fe8feb3426ddea3045d80c))
* **setup:** upgrade setup-and-run.bat with comprehensive interactive assistant menu for web, electron, mobile sync, and CLI ([d984738](https://github.com/SudhirDevOps1/SafeVault/commit/d984738f4fc5024a3d092b1e22479f37b96f5a8c))
* **sync:** implement Double-Layer E2EE local sync and live auto-sync integration across all devices ([df17ad9](https://github.com/SudhirDevOps1/SafeVault/commit/df17ad98025baa1acfec91b63f3781e15305798f))
* update VaultSetup to enforce writing and verifying the BIP39 recovery phrase ([8265c20](https://github.com/SudhirDevOps1/SafeVault/commit/8265c20eacfdc3c351e25518b336ed86e8fdf875))
* **updates:** add optional check for updates toggle via GitHub API and notification banner ([0ba0eac](https://github.com/SudhirDevOps1/SafeVault/commit/0ba0eac9eb1fb69e936580feb35274423178d490))
* **v1.4.0:** privacy-first hardening — air-gap mode, honeypot credentials, audit log, lock-on-sleep, privacy dashboard ([890d8dd](https://github.com/SudhirDevOps1/SafeVault/commit/890d8ddcb66ad8331bb04420f7a703e220e88feb))
* **v1.4.1:** fix memory leak and CSV export vulnerabilities — implement zero-fill key scrubbing in RAM and gated CSV warnings ([a9e35da](https://github.com/SudhirDevOps1/SafeVault/commit/a9e35dae5d7de585b3d7541e0265577776c1b4b2))
* **v1.4.1:** sync security hardening — upgrade to Argon2id WASM key derivation, timestamp hash handshake authentication, and server E2EE bypass ([0403f8e](https://github.com/SudhirDevOps1/SafeVault/commit/0403f8e644f9c7a7455b5f82c0adf9a16d9ce4ed))
* wrap credentials form, unlock and setup screens in standard form tags to support native OS and browser autofill ([c307a45](https://github.com/SudhirDevOps1/SafeVault/commit/c307a45486663ffb75a9c21ded9e28cb162383d3))


### Bug Fixes

* add missing CI scripts to package.json (typecheck, test, test:coverage) ([01e7e04](https://github.com/SudhirDevOps1/SafeVault/commit/01e7e045aba7a360fad68534c60c4e1c42254f28))
* allow usesCleartextTraffic inside AndroidManifest.xml for local HTTP Wi-Fi sync connections ([e38920f](https://github.com/SudhirDevOps1/SafeVault/commit/e38920f7991cbec9c5148c954bdf11a02c7be0be))
* **build:** clear extension/assets target directory before copying latest transpile bundles to prevent duplicate or stale cache file execution ([e7eefe9](https://github.com/SudhirDevOps1/SafeVault/commit/e7eefe97905ff7eab7681a5c648e9bf82c0cb175))
* **build:** resolve chunk size warnings by adding manualChunks splitting and raising warning threshold in vite.config.ts ([03fe0d3](https://github.com/SudhirDevOps1/SafeVault/commit/03fe0d30134ebcfcdfaf381b3672324d3d6d4590))
* change androidScheme to http and enable cleartext/mixed content server properties inside capacitor.config.ts ([9e0fb79](https://github.com/SudhirDevOps1/SafeVault/commit/9e0fb79460305fc59a15eb15774bf55802e7baea))
* **ci:** add typecheck, test, electron:build scripts and electron dependencies to package.json ([eed03aa](https://github.com/SudhirDevOps1/SafeVault/commit/eed03aa13b8d858e5b0841503a24d97098a40a71))
* **ci:** resolve JSDOM subtle crypto polyfill and remove per-test crypto clobbering ([ea1363a](https://github.com/SudhirDevOps1/SafeVault/commit/ea1363a1c00ce8e5156e0971ec13c634c0a31390))
* **ci:** sync package-lock.json and update CodeQL language to javascript-typescript ([8f20c01](https://github.com/SudhirDevOps1/SafeVault/commit/8f20c01181dee4c4d605087dc5dbc57fd6f9a8c4))
* **ci:** use native crypto in test setup and align node matrix to 22 LTS ([6876a4e](https://github.com/SudhirDevOps1/SafeVault/commit/6876a4e377e6990735f656cb0932e119ddce14fe))
* **cli:** implement infinite menu loop in interactiveMode to prevent sudden process exit ([3f9afa5](https://github.com/SudhirDevOps1/SafeVault/commit/3f9afa506c3a8f6d3744c61206d6e1a78730e187))
* **cli:** rename safevault.js to safevault.cjs to prevent ES module requirement type conflict ([4b5778e](https://github.com/SudhirDevOps1/SafeVault/commit/4b5778e5de0e62e3406f9767aa6e7b6770fc54d1))
* declare camera permissions and features inside AndroidManifest.xml for pairing code QR scanner ([b37feee](https://github.com/SudhirDevOps1/SafeVault/commit/b37feeed49528729666b358980f0498c3d338c87))
* **desktop:** add wasm-unsafe-eval to Content Security Policy to enable Argon2id WASM key derivation in Electron ([9bd5dfb](https://github.com/SudhirDevOps1/SafeVault/commit/9bd5dfbc9ce1d50be707776d0bb7b3a3f47ffb1d))
* **electron:** allow inline scripts in CSP for singlefile bundles and enable devTools for debugging ([0a61d1d](https://github.com/SudhirDevOps1/SafeVault/commit/0a61d1d6eed72c80886a33ebc7a6f68394d6c1ac))
* **electron:** auto fallback to dist/index.html when dev server is offline ([f6abb97](https://github.com/SudhirDevOps1/SafeVault/commit/f6abb97aaa28395bc9a772e6138999d53d178fc6))
* **electron:** exit application fully on window close instead of hiding to tray ([2ac6eba](https://github.com/SudhirDevOps1/SafeVault/commit/2ac6eba6908f70cf35b7975e8e8369c5870c2066))
* **electron:** fix index.html load path, set relative base, and setup desktop resources ([23fcc88](https://github.com/SudhirDevOps1/SafeVault/commit/23fcc889ec49707a72e905aabc58058f135cdf8b))
* **electron:** generate and link resources/icon.ico for Windows desktop application ([940d3c4](https://github.com/SudhirDevOps1/SafeVault/commit/940d3c4251d7699953d23ede0d59dc3f05a2b319))
* **electron:** rename main and preload scripts to .cjs to prevent ESM require error ([1ec8ed2](https://github.com/SudhirDevOps1/SafeVault/commit/1ec8ed23a89ad7d8a0cb9306054017d87d4cf2be))
* **electron:** simplify win target to portable to bypass winCodeSign symlink privilege error ([5a126ce](https://github.com/SudhirDevOps1/SafeVault/commit/5a126cef78c2c7517ee123d805c4a4aa9158b7bd))
* **electron:** update package.json metadata for electron-builder ([6dfe440](https://github.com/SudhirDevOps1/SafeVault/commit/6dfe44010acce56b95e7473cac6effb9ece947ed))
* **electron:** update resources/icon.ico to exact 256x256 resolution as required by electron-builder ([7c77c8d](https://github.com/SudhirDevOps1/SafeVault/commit/7c77c8df81a265bc57f7c1288dab7a4c5eb570ad))
* enforce AES-GCM transport encryption for local Wi-Fi sync and fix Cloud Relay decrypt arguments ([6d4d729](https://github.com/SudhirDevOps1/SafeVault/commit/6d4d7297a365e04020820ef53e1c6faf09441a0b))
* enforce Argon2id on master password changes and fix default update checking filters ([be4cd92](https://github.com/SudhirDevOps1/SafeVault/commit/be4cd92b9223cbf72a41c0a22a90924b73174390))
* enforce clipboard auto-clear in legacy web browser fallbacks ([e6fbc9b](https://github.com/SudhirDevOps1/SafeVault/commit/e6fbc9b0fa59bc86d41fd76a83e986a133f76ae4))
* **extension:** bypass WebShowcase display inside extension popup and mobile device views to show direct centered vault setup/unlock form ([625c0a3](https://github.com/SudhirDevOps1/SafeVault/commit/625c0a39e703f4936f5f69ad57c283f26f258cbd))
* **extension:** enable vertical scrolling inside popup body while hiding scrollbar elements to fix screen overflow block ([47062d1](https://github.com/SudhirDevOps1/SafeVault/commit/47062d1af6bcdabb1c678e9c60a86882a61e7101))
* **extension:** point default_popup directly to index.html to resolve iframe loading blank screen and inject dynamic styling ([130a3ce](https://github.com/SudhirDevOps1/SafeVault/commit/130a3ce3d5b2b7bd2d964f6179eb436173c86e26))
* **extension:** remove singlefile plugin in favor of recursive standard asset copy to satisfy MV3 Content Security Policy ([d55b50c](https://github.com/SudhirDevOps1/SafeVault/commit/d55b50cdfd0420cbf807604bc2fd81084c3bd1b5))
* **extension:** resolve iframe sandbox loading error by automated local copy of singlefile index.html ([a0143a2](https://github.com/SudhirDevOps1/SafeVault/commit/a0143a208bc32846f61b3bf0076d53734ad6195f))
* harden runSecurityAudit against single-fetch failures and insecure contexts ([bb85d69](https://github.com/SudhirDevOps1/SafeVault/commit/bb85d69a3f8ed75a9011e29ca40a2f098e58b237))
* implement graceful key derivation fallback from Argon2id to PBKDF2 for restricted Chrome Extension environments ([a5220c6](https://github.com/SudhirDevOps1/SafeVault/commit/a5220c6bf41ab1e8923a846d9217c0800096e524))
* improve global rejection logger to print descriptive values for custom error objects ([20378c5](https://github.com/SudhirDevOps1/SafeVault/commit/20378c5088626a7a3fe09556c10dccc1b5231853))
* load favicons only when network is approved and fallback to globe icon on load error; expand alias generator specs ([ab4ca9a](https://github.com/SudhirDevOps1/SafeVault/commit/ab4ca9ac7794b740e1ca69ace7ff3a6a042a72e7))
* resolve 4 critical bugs - PIN unlock PBKDF2, IV storage, backup import kdf support, background.js CryptoKey serialization ([bf28300](https://github.com/SudhirDevOps1/SafeVault/commit/bf283008ecea070da337406fb67e4aa2e6993edd))
* resolve Electron CSP connect-src, sync-server IPv4 family types, update checking semantic logic, and add camera permissions to manifest ([2cc264c](https://github.com/SudhirDevOps1/SafeVault/commit/2cc264cf6407e75dd22de576a34a3b721afec55a))
* resolve logger test case crash by ensuring redaction occurs before stringification ([4798e03](https://github.com/SudhirDevOps1/SafeVault/commit/4798e0388ee351f37c3a9d58ce37714e4ab74bd0))
* resolve merge conflict in LICENSE ([76c8f8e](https://github.com/SudhirDevOps1/SafeVault/commit/76c8f8e11bc677adf736cfc70216a71129233582))
* resolve same master password requirements error logging inside sync modules ([c2858a2](https://github.com/SudhirDevOps1/SafeVault/commit/c2858a29e36020cfecf80fb01d352f56ddd3b676))
* resolve same password sync error by utilizing PBKDF2 uniformly for transit pairing session keys and standardizing vault KDF ([5408e2f](https://github.com/SudhirDevOps1/SafeVault/commit/5408e2f14448c888caba1f2b42e0ea2e1a1a3d7a))
* restore clean configuration without invalid camera permission and resolve base64 atob mobile sync issues ([44c26a6](https://github.com/SudhirDevOps1/SafeVault/commit/44c26a68f9aa1f0f4b511a17e7c928971ee4cea1))
* **security:** resolve atob base64 decoding crash during PIN setup by using cryptographically secure random bytes as salt ([bb3adb5](https://github.com/SudhirDevOps1/SafeVault/commit/bb3adb59de215edf500a7f32fe30d536c8fa5310))
* **security:** resolve clipboard plaintext leak by clearing OS clipboard instantly on component unmount operations ([5d5849b](https://github.com/SudhirDevOps1/SafeVault/commit/5d5849b7f1a329d5883b749f0add4c581061ec83))
* **security:** resolve server EADDRINUSE crash and completely wipe all tables/tombstones on vault reset ([7a0b988](https://github.com/SudhirDevOps1/SafeVault/commit/7a0b988cc3457bdf9c15f0d73b4067cca97dd9bb))
* set extractable=true in deriveKey so wrapKey can export master key for recovery phrase vault creation ([0ed095c](https://github.com/SudhirDevOps1/SafeVault/commit/0ed095cd2a86bdc5229b6ca611b1b9bc59b54805))
* **setup:** add pause statement before exit inside setup-and-run.bat to keep CMD window open on exit ([ea6dc18](https://github.com/SudhirDevOps1/SafeVault/commit/ea6dc18d159fb9f807dae1ef32aa602cdbcedf96))
* **setup:** all options 1-7 now open in separate CMD windows so launcher never closes ([e3ec2b7](https://github.com/SudhirDevOps1/SafeVault/commit/e3ec2b76856705165423fa0148001157bd3b1feb))
* **setup:** escape nested parenthesis and simplify unicode characters to ensure complete setup-and-run.bat execution compatibility ([a44a41a](https://github.com/SudhirDevOps1/SafeVault/commit/a44a41a567691138ef4e34cbc8f6d398ff34a4d6))
* **setup:** open CLI in separate window on option 6 to prevent launcher from closing ([9da2b7b](https://github.com/SudhirDevOps1/SafeVault/commit/9da2b7b45af70c64ca3e6b7ba25f4e1c0ebf5b54))
* **setup:** replace set/p with choice command to fix infinite loop and stdin consumption bug ([e40c83f](https://github.com/SudhirDevOps1/SafeVault/commit/e40c83fe944dbb3606a9909fd39e9d6241ec71ba))
* **setup:** resolve parenthesis nesting conflict inside warning block in setup-and-run.bat ([ff83726](https://github.com/SudhirDevOps1/SafeVault/commit/ff837265f65b9cdf57a623595131b63b395f1c74))
* **sidebar:** use inline SVG for GitHub icon to resolve module compilation error ([9a1b7ea](https://github.com/SudhirDevOps1/SafeVault/commit/9a1b7ea24b08f5086b38c165fd8e9bb953efa5b5))
* **sync:** replace spread-operator base64 conversion with safe loop-based helpers inside LocalSync.tsx to resolve atob encoding crash ([1284b67](https://github.com/SudhirDevOps1/SafeVault/commit/1284b67940c62cbb0bcec70c2f187eaa6dea6265))
* **sync:** resolve 6 critical sync bugs — ghost credentials, auto-discover, stale server state, relay QR, last-sync timestamp, extension default relay mode ([487e7a8](https://github.com/SudhirDevOps1/SafeVault/commit/487e7a82ba601ca68fb3d53fba3635fdad9310f4))
* **typecheck:** cast resIv as any and combined to ArrayBuffer to resolve type mismatch errors in decrypt params ([0311844](https://github.com/SudhirDevOps1/SafeVault/commit/0311844a999dd9abcaf22bcb31fe48f8d78a5ab7))
* update application version references to v1.4.1 and resolve Android split screen userAgent detection issues ([50fcffe](https://github.com/SudhirDevOps1/SafeVault/commit/50fcffed0bc2626a0ab3a334542732d9680d6c13))
* update direct download URLs to match GitHub Actions naming conventions to resolve 404 download errors ([9d83b0c](https://github.com/SudhirDevOps1/SafeVault/commit/9d83b0c113357c534febdd99d65d6f48149ffd36))
* **updater:** resolve desktop silent updater failure by cleanly following HTTP redirects and using shell.openPath to trigger administrative UAC prompts ([df6473f](https://github.com/SudhirDevOps1/SafeVault/commit/df6473f17ab9382fc495ae9b73969ed2bedc3f48))
* upgrade Java JDK to 21 in CI/release workflows to satisfy source compatibility compiler requirements, and bump version to v1.1.5 ([409d78a](https://github.com/SudhirDevOps1/SafeVault/commit/409d78a0187f09ccd85a332e84f7d864c91a599d))
* upgrade Node version to 22 in CI/release workflows to resolve Capacitor CLI requirement, and bump version to v1.1.4 ([81361a0](https://github.com/SudhirDevOps1/SafeVault/commit/81361a037255589145985d41d14c3b0afaecb50d))
* **version:** update settings footer info string to show v1.4.2 ([b0027e6](https://github.com/SudhirDevOps1/SafeVault/commit/b0027e654fac6f274ac5ac7d855b6acb90a9fa1a))
* **version:** update stale v1.1.5 CLI header references and package-lock files to v1.4.2 ([6138e87](https://github.com/SudhirDevOps1/SafeVault/commit/6138e87239584f47778205f0260a0435d597e5be))


### Performance Improvements

* **hooks:** optimize useAutoLock listener performance to prevent layout churn ([27970ee](https://github.com/SudhirDevOps1/SafeVault/commit/27970ee974ecf7ffadd244259b25a19812f671b6))
* **list:** optimize Zustand subscriptions with atomic selectors to prevent unnecessary list re-renders ([b3b998d](https://github.com/SudhirDevOps1/SafeVault/commit/b3b998d5d3eca76a5c8f5728de6c0498da89fecd))
