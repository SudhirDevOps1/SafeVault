// SafeVault Extension Content Script (Manifest V3)
// Proton Pass & Bitwarden style In-Field Auto-fill, Password Generator & Form Interceptor

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
  let savePromptEl = null;

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

  // Find login credentials fields on page
  function detectFormFields() {
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
    });

    return passwordInputs.map(passInput => {
      let usernameInput = null;
      const form = passInput.closest('form') || document;
      const allInputs = Array.from(form.querySelectorAll('input')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });

      const passIdx = allInputs.indexOf(passInput);

      // Search backward from password field for username/email
      for (let i = passIdx - 1; i >= 0; i--) {
        const inp = allInputs[i];
        const type = (inp.getAttribute('type') || 'text').toLowerCase();
        const name = (inp.getAttribute('name') || '').toLowerCase();
        const autocomplete = (inp.getAttribute('autocomplete') || '').toLowerCase();

        if (
          type === 'text' ||
          type === 'email' ||
          autocomplete.includes('username') ||
          autocomplete.includes('email') ||
          name.includes('user') ||
          name.includes('login') ||
          name.includes('email')
        ) {
          usernameInput = inp;
          break;
        }
      }

      // If no form wrapper and not found, check any visible email/username input
      if (!usernameInput) {
        usernameInput = document.querySelector('input[autocomplete="username"], input[type="email"], input[name*="user" i]');
      }

      const isNewPassword = passInput.getAttribute('autocomplete') === 'new-password' ||
        passInput.name.toLowerCase().includes('confirm') ||
        passInput.name.toLowerCase().includes('new');

      return { passInput, usernameInput, isNewPassword };
    });
  }

  // Remove any open SafeVault dropdown
  function closeDropdown() {
    if (activeDropdown && activeDropdown.parentNode) {
      activeDropdown.parentNode.removeChild(activeDropdown);
      activeDropdown = null;
    }
  }

  // Show inline floating credential selector
  function showDropdown(anchorInput, credsData, isNewPass = false) {
    closeDropdown();

    const rect = anchorInput.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'safevault-dropdown-root';
    activeDropdown = dropdown;

    Object.assign(dropdown.style, {
      position: 'absolute',
      top: `${window.scrollY + rect.bottom + 6}px`,
      left: `${window.scrollX + rect.left}px`,
      width: `${Math.max(rect.width, 280)}px`,
      maxWidth: '360px',
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

    let contentHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 8px; border-bottom: 1px solid #1e293b; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #10b981;">
          ${SHIELD_ICON_SVG}
          <span>SafeVault</span>
        </div>
        <span style="font-size: 11px; color: #64748b;">${window.location.hostname}</span>
      </div>
    `;

    if (!isUnlocked) {
      contentHtml += `
        <div style="padding: 12px 8px; text-align: center; color: #94a3b8;">
          <p style="margin: 0 0 8px 0; font-size: 12px;">Vault is locked</p>
          <div style="font-size: 11px; color: #10b981;">Click SafeVault icon in extension bar to unlock</div>
        </div>
      `;
    } else if (creds.length === 0 && !isNewPass) {
      contentHtml += `
        <div style="padding: 10px 8px; text-align: center; color: #94a3b8; font-size: 12px;">
          No matching logins found for this site.
        </div>
      `;
    } else {
      creds.forEach((c, index) => {
        contentHtml += `
          <div class="safevault-cred-item" data-index="${index}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s; margin-bottom: 4px; background: #1e293b;">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px;">
              <div style="font-weight: 600; color: #ffffff;">${c.title || c.username}</div>
              <div style="font-size: 11px; color: #94a3b8;">${c.username || 'No username'}</div>
            </div>
            <button class="safevault-fill-btn" style="background: #10b981; color: #022c22; font-weight: 600; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer;">
              Fill
            </button>
          </div>
        `;
      });
    }

    // Add Password Generator Action
    contentHtml += `
      <div id="safevault-generate-btn" style="display: flex; align-items: center; gap: 6px; padding: 8px; margin-top: 4px; border-radius: 8px; cursor: pointer; background: #064e3b; color: #a7f3d0; font-size: 12px; font-weight: 500;">
        <span>✨</span>
        <span>Generate Strong Password</span>
      </div>
    `;

    dropdown.innerHTML = contentHtml;
    document.body.appendChild(dropdown);

    // Attach Event Listeners to Items
    dropdown.querySelectorAll('.safevault-cred-item').forEach(itemEl => {
      itemEl.addEventListener('mouseenter', () => { itemEl.style.background = '#334155'; });
      itemEl.addEventListener('mouseleave', () => { itemEl.style.background = '#1e293b'; });
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(itemEl.getAttribute('data-index') || '0', 10);
        const cred = creds[index];
        if (cred) {
          autofillSingle(cred);
          showToast('Credentials auto-filled!');
        }
        closeDropdown();
      });
    });

    const genBtn = dropdown.querySelector('#safevault-generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'GENERATE_PASSWORD' }, (res) => {
          if (res?.password) {
            setNativeValue(anchorInput, res.password);
            // If there is a confirmation password field, fill it too
            const confirmPass = document.querySelector('input[type="password"]:not([id="' + anchorInput.id + '"])');
            if (confirmPass) setNativeValue(confirmPass, res.password);
            try {
              navigator.clipboard.writeText(res.password);
            } catch {}
            showToast('Password generated, filled & copied to clipboard!');
          }
        });
        closeDropdown();
      });
    }
  }

  // Autofill specific credential
  function autofillSingle(cred) {
    const pairs = detectFormFields();
    if (pairs.length > 0) {
      const primary = pairs[0];
      if (primary.usernameInput && cred.username) {
        setNativeValue(primary.usernameInput, cred.username);
      }
      if (primary.passInput && cred.password) {
        setNativeValue(primary.passInput, cred.password);
      }
    } else {
      const anyPass = document.querySelector('input[type="password"]');
      if (anyPass && cred.password) setNativeValue(anyPass, cred.password);
      const anyUser = document.querySelector('input[type="email"], input[autocomplete="username"], input[name*="user" i]');
      if (anyUser && cred.username) setNativeValue(anyUser, cred.username);
    }
  }

  // Toast feedback
  function showToast(message) {
    const toast = document.createElement('div');
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
    toast.innerHTML = `${SHIELD_ICON_SVG}<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2800);
  }

  // Attach Proton Pass / Bitwarden style in-field shield icon
  function attachFieldBadges() {
    const fields = detectFormFields();

    fields.forEach(({ passInput, usernameInput, isNewPassword }) => {
      const targetInputs = [passInput, usernameInput].filter(Boolean);

      targetInputs.forEach(input => {
        if (input.dataset.safevaultAttached) return;
        input.dataset.safevaultAttached = 'true';

        // Create Badge Button
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
          badge.style.left = `${window.scrollX + rect.right - 30}px`;
        }

        positionBadge();
        document.body.appendChild(badge);

        // Reposition on window resize / scroll
        window.addEventListener('resize', positionBadge, { passive: true });
        window.addEventListener('scroll', positionBadge, { passive: true });

        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.runtime.sendMessage({ action: 'GET_MATCHING_CREDENTIALS', url: window.location.href }, (response) => {
            showDropdown(input, response || { isUnlocked: false, credentials: [] }, isNewPassword);
          });
        });
      });
    });
  }

  // Intercept Form Submission to Prompt Save Credential
  function interceptFormSubmissions() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      const passInput = form.querySelector('input[type="password"]');
      if (!passInput || !passInput.value) return;

      const userInput = form.querySelector('input[type="email"], input[type="text"], input[autocomplete="username"], input[name*="user" i]');
      const username = userInput ? userInput.value : '';
      const password = passInput.value;

      if (password) {
        showSavePrompt(username, password);
      }
    }, true);
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

  // Prompt user to save credential
  function showSavePrompt(username, password) {
    if (savePromptEl) savePromptEl.remove();

    const banner = document.createElement('div');
    savePromptEl = banner;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '320px',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px #10b981',
      zIndex: '2147483647',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      padding: '14px',
      boxSizing: 'border-box'
    });

    const safeHost = escapeHtml(window.location.hostname);
    const safeUser = escapeHtml(username);

    banner.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #10b981;">
          ${SHIELD_ICON_SVG}
          <span>Save Password to SafeVault?</span>
        </div>
        <button id="safevault-close-prompt" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 16px; line-height: 1;">✕</button>
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
        <div><strong>Site:</strong> ${safeHost}</div>
        ${safeUser ? `<div><strong>User:</strong> ${safeUser}</div>` : ''}
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button id="safevault-dismiss-save" style="background: #1e293b; color: #94a3b8; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">
          Never for this site
        </button>
        <button id="safevault-confirm-save" style="background: #10b981; color: #022c22; font-weight: 600; border: none; border-radius: 6px; padding: 6px 14px; font-size: 12px; cursor: pointer;">
          Save
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('#safevault-close-prompt').addEventListener('click', () => banner.remove());
    banner.querySelector('#safevault-dismiss-save').addEventListener('click', () => banner.remove());
    banner.querySelector('#safevault-confirm-save').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'SAVE_SUBMITTED_CREDENTIAL',
        username,
        password,
        url: window.location.href,
        title: document.title || window.location.hostname
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
      autofillSingle({ username: message.username, password: message.password });
      showToast('Credentials auto-filled!');
      sendResponse({ success: true });
    } else if (message.action === 'TRIGGER_AUTOFILL') {
      chrome.runtime.sendMessage({ action: 'GET_MATCHING_CREDENTIALS', url: window.location.href }, (response) => {
        if (response?.credentials?.length === 1) {
          autofillSingle(response.credentials[0]);
          showToast('Credentials auto-filled!');
        } else if (response?.credentials?.length > 1) {
          const fields = detectFormFields();
          const target = fields[0]?.passInput || fields[0]?.usernameInput || document.querySelector('input');
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
