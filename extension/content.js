// SafeVault Extension Content Script (Manifest V3)
// Proton Pass & Bitwarden style In-Field Auto-fill, TOTP 2FA Auto-copy & Smart Form Scanner

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__safevault_injected) return;
  window.__safevault_injected = true;

  const SHIELD_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `;

  let activeDropdown = null;
  let activeAnchorInput = null;
  let savePromptEl = null;
  let clipboardClearTimer = null;

  // Autofill configuration (synced from SafeVault settings)
  let autofillSettings = {
    credentialAutofillEnabled: true,
    twoFactorAutofillEnabled: true,
    autoCopy2faToClipboard: true,
    saveLoginPromptEnabled: true,
    blockedSites: ['accounts.google.com/oauth'],
    autofillMatchingMode: 'wildcard'
  };

  // Multi-part country code TLDs
  const MULTI_PART_TLDS = [
    'co.uk', 'co.in', 'com.au', 'com.br', 'co.jp', 'co.nz', 'co.za',
    'org.uk', 'gov.in', 'ac.uk', 'pages.dev', 'github.io', 'web.app'
  ];

  // Extract clean service name (e.g. accounts.google.com -> google, github.com -> github, amazon.co.in -> amazon)
  function extractCleanServiceName(urlOrHost) {
    if (!urlOrHost) return 'service';
    try {
      let hostname = urlOrHost.trim();
      if (hostname.includes('://')) {
        hostname = new URL(hostname).hostname;
      }
      hostname = hostname.toLowerCase().split(':')[0].replace(/^www\./, '');

      for (const tld of MULTI_PART_TLDS) {
        if (hostname.endsWith('.' + tld)) {
          const sub = hostname.slice(0, -(tld.length + 1)).split('.');
          const candidate = sub[sub.length - 1];
          if (candidate) return candidate.replace(/[^a-z0-9]/g, '');
        }
      }

      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts[parts.length - 2].replace(/[^a-z0-9]/g, '') || 'service';
      }
      return parts[0].replace(/[^a-z0-9]/g, '') || 'service';
    } catch {
      return 'service';
    }
  }

  // Check if current site is in blocked sites list
  function isSiteBlocked() {
    const currentHost = window.location.hostname.toLowerCase();
    return (autofillSettings.blockedSites || []).some(site => {
      const clean = (site || '').toLowerCase().trim();
      return clean && (currentHost === clean || currentHost.endsWith('.' + clean));
    });
  }

  // Load autofill settings from chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['safevault_autofill_settings'], (res) => {
      if (res?.safevault_autofill_settings) {
        try {
          autofillSettings = { ...autofillSettings, ...JSON.parse(res.safevault_autofill_settings) };
        } catch {}
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Set input value compatibly with React, Angular, Vue & native inputs
  function setNativeValue(element, value) {
    if (!element) return;
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  // Copy text to clipboard and auto-clear after 30 seconds
  function copyToClipboardAutoClear(text) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text).catch(() => {});
    } catch {
      // Fallback textarea
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      } catch {}
    }

    if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
    clipboardClearTimer = setTimeout(() => {
      try {
        navigator.clipboard.writeText('').catch(() => {});
      } catch {}
    }, 30000);
  }

  // Smart Form Scanner: identifies email, username, name, password & 2FA fields
  function scanFormFields(root = document) {
    const inputs = Array.from(root.querySelectorAll('input'))
      .filter(el => {
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'image'].includes(type)) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });

    let passwordInput = null;
    let confirmPasswordInput = null;
    let emailInput = null;
    let usernameInput = null;
    let nameInput = null;
    let totpInput = null;

    for (const input of inputs) {
      const type = (input.getAttribute('type') || 'text').toLowerCase();
      const name = (input.getAttribute('name') || '').toLowerCase();
      const id = (input.getAttribute('id') || '').toLowerCase();
      const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();

      // 1. 2FA / TOTP input detection
      if (
        autocomplete === 'one-time-code' ||
        name.includes('totp') || name.includes('otp') || name.includes('2fa') || name.includes('code') ||
        id.includes('totp') || id.includes('otp') || id.includes('2fa') ||
        placeholder.includes('code') || placeholder.includes('otp')
      ) {
        if (!totpInput) totpInput = input;
        continue;
      }

      // 2. Password input detection
      if (type === 'password') {
        if (!passwordInput) {
          passwordInput = input;
        } else if (!confirmPasswordInput) {
          confirmPasswordInput = input;
        }
        continue;
      }

      // 3. Email input detection (e.g. type=email, name=email, placeholder=name@company.com)
      if (
        type === 'email' ||
        name.includes('email') ||
        id.includes('email') ||
        autocomplete.includes('email') ||
        placeholder.includes('@') ||
        placeholder.includes('email')
      ) {
        if (!emailInput) emailInput = input;
        continue;
      }

      // 4. Full Name detection (e.g. name=fullName)
      if (name.includes('name') && !name.includes('user') && !name.includes('email')) {
        if (!nameInput) nameInput = input;
        continue;
      }

      // 5. Username detection
      if (
        autocomplete.includes('username') ||
        name.includes('user') || name.includes('login') ||
        id.includes('user') || id.includes('login') ||
        placeholder.includes('user')
      ) {
        if (!usernameInput) usernameInput = input;
        continue;
      }
    }

    return {
      passwordInput,
      confirmPasswordInput,
      emailInput: emailInput || (usernameInput?.type === 'email' ? usernameInput : null),
      usernameInput: usernameInput || emailInput,
      nameInput,
      totpInput,
      allInteractiveInputs: inputs
    };
  }

  // Remove any open SafeVault dropdown
  function closeDropdown() {
    if (activeDropdown && activeDropdown.parentNode) {
      activeDropdown.parentNode.removeChild(activeDropdown);
      activeDropdown = null;
      activeAnchorInput = null;
    }
  }

  // Show inline floating credential selector
  function showDropdown(anchorInput, credsData) {
    if (activeDropdown && activeAnchorInput === anchorInput) {
      closeDropdown();
      return;
    }

    closeDropdown();
    activeAnchorInput = anchorInput;

    const rect = anchorInput.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'safevault-dropdown-root';
    activeDropdown = dropdown;

    Object.assign(dropdown.style, {
      position: 'absolute',
      top: `${window.scrollY + rect.bottom + 6}px`,
      left: `${window.scrollX + rect.left}px`,
      width: `${Math.max(rect.width, 280)}px`,
      maxWidth: '380px',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(16, 185, 129, 0.3)',
      zIndex: '2147483647',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      padding: '8px',
      boxSizing: 'border-box',
      animation: 'safevault-fade-in 0.15s ease-out'
    });

    const isUnlocked = credsData.isUnlocked;
    const creds = credsData.credentials || [];
    const isEmailField = (anchorInput.getAttribute('type') || '').toLowerCase() === 'email' ||
      (anchorInput.getAttribute('name') || '').toLowerCase().includes('email');
    const isTotpField = (anchorInput.getAttribute('autocomplete') || '').toLowerCase() === 'one-time-code' ||
      (anchorInput.getAttribute('name') || '').toLowerCase().includes('otp') ||
      (anchorInput.getAttribute('name') || '').toLowerCase().includes('totp') ||
      (anchorInput.getAttribute('name') || '').toLowerCase().includes('2fa') ||
      (anchorInput.getAttribute('name') || '').toLowerCase().includes('code') ||
      (anchorInput.getAttribute('id') || '').toLowerCase().includes('otp') ||
      (anchorInput.getAttribute('id') || '').toLowerCase().includes('totp');

    let contentHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 8px; border-bottom: 1px solid #1e293b; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #10b981;">
          ${SHIELD_ICON_SVG}
          <span>SafeVault</span>
        </div>
        <span style="font-size: 11px; color: #64748b;">${escapeHtml(window.location.hostname)}</span>
      </div>
    `;

    if (!isUnlocked) {
      contentHtml += `
        <div style="padding: 12px 8px; text-align: center; color: #94a3b8;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 500;">Vault is locked</p>
          <div style="font-size: 11px; color: #10b981; cursor: pointer;" id="safevault-open-popup-btn">Click SafeVault icon in extension bar to unlock</div>
        </div>
      `;
    } else if (creds.length === 0) {
      contentHtml += `
        <div style="padding: 10px 8px; text-align: center; color: #94a3b8; font-size: 12px;">
          No matching logins found for this site.
        </div>
      `;
    } else {
      creds.forEach((c, index) => {
        const hasTotp = !!c.totpCode;
        contentHtml += `
          <div class="safevault-cred-item" data-index="${index}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s; margin-bottom: 4px; background: #1e293b;">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px;">
              <div style="font-weight: 600; color: #ffffff;">${escapeHtml(c.title || c.username)}</div>
              ${isTotpField && hasTotp
                ? `<div style="font-size: 12px; font-family: monospace; color: #34d399; font-weight: 700; letter-spacing: 0.5px;">🔐 Code: ${escapeHtml(c.totpCode)}</div>`
                : `<div style="font-size: 11px; color: #94a3b8;">${escapeHtml(c.username || 'No username')}</div>`
              }
            </div>
            <button class="safevault-fill-btn" style="background: #10b981; color: #022c22; font-weight: 600; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer;">
              ${isTotpField && hasTotp ? 'Fill Code' : 'Fill'}
            </button>
          </div>
        `;
      });
    }

    // In-Field Email Alias Creation Pill (Proton Pass Style) - Clean Service Name
    if (isEmailField) {
      const cleanService = extractCleanServiceName(window.location.hostname);
      contentHtml += `
        <div id="safevault-alias-btn" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; margin-top: 4px; border-radius: 8px; cursor: pointer; background: #1e1b4b; color: #c7d2fe; font-size: 12px; font-weight: 500; border: 1px solid #4338ca;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>📧</span>
            <span>Create Alias (+${escapeHtml(cleanService)})</span>
          </div>
          <span style="font-size: 10px; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #a5b4fc; font-weight: 600;">SafeVault</span>
        </div>
      `;
    }

    // Add Password Generator Action
    contentHtml += `
      <div id="safevault-generate-btn" style="display: flex; align-items: center; gap: 6px; padding: 8px; margin-top: 4px; border-radius: 8px; cursor: pointer; background: #064e3b; color: #a7f3d0; font-size: 12px; font-weight: 500; border: 1px solid #059669;">
        <span>✨</span>
        <span>Generate Strong Password</span>
      </div>
    `;

    dropdown.innerHTML = contentHtml;
    document.body.appendChild(dropdown);

    // Event Listeners for Credential Items
    dropdown.querySelectorAll('.safevault-cred-item').forEach(itemEl => {
      itemEl.addEventListener('mouseenter', () => { itemEl.style.background = '#334155'; });
      itemEl.addEventListener('mouseleave', () => { itemEl.style.background = '#1e293b'; });
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(itemEl.getAttribute('data-index') || '0', 10);
        const cred = creds[index];
        if (cred) {
          autofillSingle(cred);
        }
        closeDropdown();
      });
    });

    // Password Generator button
    const genBtn = dropdown.querySelector('#safevault-generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'GENERATE_PASSWORD' }, (res) => {
          if (res?.password) {
            setNativeValue(anchorInput, res.password);
            const fields = scanFormFields();
            if (fields.confirmPasswordInput) {
              setNativeValue(fields.confirmPasswordInput, res.password);
            }
            copyToClipboardAutoClear(res.password);
            showToast('Password generated, filled & copied to clipboard!');
          }
        });
        closeDropdown();
      });
    }

    // Email Alias button
    const aliasBtn = dropdown.querySelector('#safevault-alias-btn');
    if (aliasBtn) {
      aliasBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({
          action: 'GENERATE_AND_SAVE_ALIAS',
          hostname: window.location.hostname,
          url: window.location.href
        }, (res) => {
          if (res?.alias) {
            setNativeValue(anchorInput, res.alias);
            copyToClipboardAutoClear(res.alias);
            showToast(`✨ Generated & saved: ${res.alias}`);

            // Fill password field if present on registration form
            const fields = scanFormFields();
            if (fields.passwordInput && res.password) {
              setNativeValue(fields.passwordInput, res.password);
              if (fields.confirmPasswordInput) {
                setNativeValue(fields.confirmPasswordInput, res.password);
              }
            }
          }
        });
        closeDropdown();
      });
    }
  }

  // Autofill specific credential into detected form fields
  function autofillSingle(cred) {
    const fields = scanFormFields();
    let filledSomething = false;

    // 1. Fill Email / Username field
    if (cred.username) {
      const isEmail = cred.username.includes('@');
      if (isEmail && fields.emailInput) {
        setNativeValue(fields.emailInput, cred.username);
        filledSomething = true;
      } else if (fields.usernameInput) {
        setNativeValue(fields.usernameInput, cred.username);
        filledSomething = true;
      } else if (fields.emailInput) {
        setNativeValue(fields.emailInput, cred.username);
        filledSomething = true;
      }
    }

    // 2. Fill Password field
    if (cred.password && fields.passwordInput) {
      setNativeValue(fields.passwordInput, cred.password);
      filledSomething = true;
      if (fields.confirmPasswordInput) {
        setNativeValue(fields.confirmPasswordInput, cred.password);
      }
    }

    // 3. Auto-fill 2FA TOTP input if present on page
    if (cred.totpCode && fields.totpInput) {
      setNativeValue(fields.totpInput, cred.totpCode);
    }

    // 4. Auto-copy 2FA TOTP code to clipboard (Proton Pass & Bitwarden standard)
    if (cred.totpCode) {
      copyToClipboardAutoClear(cred.totpCode);
      showToast(`Credentials filled! 2FA Code (${cred.totpCode}) copied to clipboard`);
    } else if (filledSomething) {
      showToast('Credentials auto-filled!');
    }
  }

  // Toast feedback element
  function showToast(message) {
    const existing = document.querySelector('.safevault-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'safevault-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#064e3b',
      color: '#ecfdf5',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      zIndex: '2147483647',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.4), 0 0 0 1px #10b981',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'system-ui, sans-serif',
      transition: 'all 0.2s ease'
    });
    toast.innerHTML = `${SHIELD_ICON_SVG}<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  // Attach Proton Pass / Bitwarden style in-field shield icon
  function attachFieldBadges() {
    if (isSiteBlocked()) return;
    if (autofillSettings.credentialAutofillEnabled === false && autofillSettings.twoFactorAutofillEnabled === false) return;

    const fields = scanFormFields();
    const targetInputs = [];

    if (autofillSettings.credentialAutofillEnabled !== false) {
      if (fields.passwordInput) targetInputs.push(fields.passwordInput);
      if (fields.emailInput) targetInputs.push(fields.emailInput);
      if (fields.usernameInput) targetInputs.push(fields.usernameInput);
    }

    if (autofillSettings.twoFactorAutofillEnabled !== false && fields.totpInput) {
      targetInputs.push(fields.totpInput);
    }

    targetInputs.forEach(input => {
      if (input.dataset.safevaultAttached) return;
      input.dataset.safevaultAttached = 'true';

      const badge = document.createElement('div');
      badge.className = 'safevault-infield-badge';
      badge.innerHTML = SHIELD_ICON_SVG;
      badge.title = 'SafeVault Auto-fill';

      Object.assign(badge.style, {
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        cursor: 'pointer',
        zIndex: '1000',
        opacity: '0.7',
        transition: 'all 0.15s ease',
        transform: 'translateY(-50%)',
        userSelect: 'none'
      });

      badge.addEventListener('mouseenter', () => {
        badge.style.opacity = '1';
        badge.style.transform = 'translateY(-50%) scale(1.15)';
      });
      badge.addEventListener('mouseleave', () => {
        badge.style.opacity = '0.7';
        badge.style.transform = 'translateY(-50%) scale(1)';
      });

      function positionBadge() {
        const rect = input.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        badge.style.top = `${window.scrollY + rect.top + rect.height / 2}px`;
        badge.style.left = `${window.scrollX + rect.right - 28}px`;
      }

      positionBadge();
      document.body.appendChild(badge);

      window.addEventListener('resize', positionBadge, { passive: true });
      window.addEventListener('scroll', positionBadge, { passive: true });

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeDropdown && activeAnchorInput === input) {
          closeDropdown();
          return;
        }
        chrome.runtime.sendMessage({ action: 'GET_MATCHING_CREDENTIALS', url: window.location.href }, (response) => {
          showDropdown(input, response || { isUnlocked: false, credentials: [] });
        });
      });
    });
  }

  // Intercept Form Submission to Prompt Save Credential
  function interceptFormSubmissions() {
    document.addEventListener('submit', (e) => {
      if (isSiteBlocked() || autofillSettings.saveLoginPromptEnabled === false) return;
      const form = e.target;
      const fields = scanFormFields(form);
      if (!fields.passwordInput || !fields.passwordInput.value) return;

      const username = fields.emailInput?.value || fields.usernameInput?.value || '';
      const password = fields.passwordInput.value;

      if (password) {
        showSavePrompt(username, password);
      }
    }, true);
  }

  // Prompt user to save credential
  function showSavePrompt(username, password) {
    if (savePromptEl) savePromptEl.remove();

    const banner = document.createElement('div');
    savePromptEl = banner;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px #10b981',
      padding: '16px',
      zIndex: '2147483647',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      maxWidth: '360px',
      animation: 'safevault-fade-in 0.2s ease-out'
    });

    const pageTitle = document.title ? document.title.split(/[-|:]/)[0].trim() : window.location.hostname;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #10b981; margin-bottom: 8px;">
        ${SHIELD_ICON_SVG}
        <span>Save to SafeVault?</span>
      </div>
      <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 12px;">
        Save login for <strong style="color: #fff;">${escapeHtml(pageTitle)}</strong> (${escapeHtml(username || 'Account')})?
      </p>
      <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
        <button id="safevault-block-save" style="background: transparent; color: #f87171; border: 1px solid rgba(248,113,113,0.3); padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;">Never for this site</button>
        <button id="safevault-cancel-save" style="background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;">Cancel</button>
        <button id="safevault-confirm-save" style="background: #10b981; color: #022c22; font-weight: 600; border: none; padding: 5px 14px; border-radius: 6px; cursor: pointer; font-size: 11px;">Save</button>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('#safevault-cancel-save')?.addEventListener('click', () => {
      banner.remove();
    });

    banner.querySelector('#safevault-block-save')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'BLOCK_SITE',
        domain: window.location.hostname
      }, () => {
        if (!autofillSettings.blockedSites) autofillSettings.blockedSites = [];
        autofillSettings.blockedSites.push(window.location.hostname.toLowerCase());
        banner.remove();
        document.querySelectorAll('.safevault-infield-badge').forEach(b => b.remove());
        showToast(`Site blocked from save prompts: ${window.location.hostname}`);
      });
    });

    banner.querySelector('#safevault-confirm-save')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'SAVE_SUBMITTED_CREDENTIAL',
        username,
        password,
        url: window.location.href,
        title: pageTitle
      }, () => {
        banner.remove();
        showToast('Password saved to SafeVault!');
      });
    });
  }

  // Handle outside clicks to close dropdown
  document.addEventListener('click', (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  // Handle messages from Extension Popup / Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'autofillCredentials') {
      autofillSingle({
        username: message.username,
        password: message.password,
        totpCode: message.totpCode
      });
      sendResponse({ success: true });
    } else if (message.action === 'AUTOFILL_SETTINGS_UPDATED') {
      autofillSettings = { ...autofillSettings, ...(message.settings || {}) };
      if (isSiteBlocked() || (autofillSettings.credentialAutofillEnabled === false && autofillSettings.twoFactorAutofillEnabled === false)) {
        document.querySelectorAll('.safevault-infield-badge').forEach(b => b.remove());
      } else {
        attachFieldBadges();
      }
      sendResponse({ success: true });
    } else if (message.action === 'VAULT_STATE_UPDATED') {
      // Re-query credentials if dropdown is currently visible to eliminate stale locked state
      if (activeDropdown && activeAnchorInput) {
        chrome.runtime.sendMessage({ action: 'GET_MATCHING_CREDENTIALS', url: window.location.href }, (response) => {
          showDropdown(activeAnchorInput, response || { isUnlocked: false, credentials: [] });
        });
      }
      sendResponse({ success: true });
    } else if (message.action === 'TRIGGER_AUTOFILL') {
      chrome.runtime.sendMessage({ action: 'GET_MATCHING_CREDENTIALS', url: window.location.href }, (response) => {
        if (response?.credentials?.length === 1) {
          autofillSingle(response.credentials[0]);
        } else if (response?.credentials?.length > 1) {
          const fields = scanFormFields();
          const target = fields.passwordInput || fields.emailInput || fields.usernameInput || fields.totpInput;
          if (target) showDropdown(target, response);
        } else {
          showToast('No matching logins for this site.');
        }
      });
      sendResponse({ success: true });
    } else if (message.action === 'FILL_GENERATED_PASSWORD') {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT') {
        setNativeValue(activeEl, message.password);
        showToast('Generated password filled!');
      }
      sendResponse({ success: true });
    }
    return true;
  });

  // Initialize Observers
  attachFieldBadges();
  interceptFormSubmissions();

  // Watch for dynamic Single Page App (SPA) form additions
  const observer = new MutationObserver(() => {
    attachFieldBadges();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
