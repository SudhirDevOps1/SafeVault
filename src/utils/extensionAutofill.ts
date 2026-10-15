// SafeVault Extension Robust Autofill Dispatcher
// Dispatches credentials to page with two-tier resilience:
// Tier 1: Message to content.js (if already injected)
// Tier 2: In-page execution via chrome.scripting.executeScript (bypasses stale/invalidated content script context)

export interface TabAutofillPayload {
  username?: string;
  password?: string;
  totpCode?: string;
}

/**
 * In-page runner executed directly inside the target tab DOM via chrome.scripting.executeScript.
 * Self-contained so it does not rely on any external scope or content script existence.
 */
function inPageDirectAutofill(u: string, p: string, t: string) {
  function setVal(el: HTMLInputElement, val: string) {
    if (!el || !val) return;
    try { el.focus(); } catch {}
    const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const proto = Object.getPrototypeOf(el);
    const protoValSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (protoValSetter && valSetter !== protoValSetter) {
      protoValSetter.call(el, val);
    } else if (valSetter) {
      valSetter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
  }

  const inputs = Array.from(document.querySelectorAll('input')).filter(el => {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'image'].includes(type)) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }) as HTMLInputElement[];

  let userField: HTMLInputElement | null = null;
  let passField: HTMLInputElement | null = null;
  let totpField: HTMLInputElement | null = null;

  for (const input of inputs) {
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.getAttribute('id') || '').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();

    if (autocomplete === 'one-time-code' || name.includes('otp') || name.includes('totp') || id.includes('otp') || id.includes('totp') || name.includes('2fa') || id.includes('2fa')) {
      if (!totpField) totpField = input;
    } else if (type === 'password') {
      if (!passField) passField = input;
    } else if (type === 'email' || name.includes('email') || id.includes('email') || autocomplete.includes('email') || placeholder.includes('@')) {
      if (!userField) userField = input;
    } else if (autocomplete.includes('username') || name.includes('user') || name.includes('login') || id.includes('user') || id.includes('login') || placeholder.includes('user')) {
      if (!userField) userField = input;
    }
  }

  // Exact selector fallbacks for common platforms (e.g. GitHub, Google, Amazon, Microsoft)
  if (!userField) {
    userField = document.querySelector(
      'input#login_field, input#user_login, input[name="login"], input[name="username"], input[name="email"], input[type="email"], input[autocomplete="username"]'
    ) as HTMLInputElement | null;
  }
  if (!passField) {
    passField = document.querySelector(
      'input[type="password"], input#password, input[name="password"], input[name="passwd"]'
    ) as HTMLInputElement | null;
  }

  if (u && userField) setVal(userField, u);
  if (p && passField) setVal(passField, p);
  if (t && totpField) setVal(totpField, t);
}

/**
 * Dispatches autofill payload to current active tab with multi-layered fallback
 */
export async function autofillActiveTab(payload: TabAutofillPayload): Promise<boolean> {
  const chrome = (typeof window !== 'undefined' ? (window as any).chrome : null);
  if (!chrome?.tabs?.query) return false;

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs: any[]) => {
      const activeTab = tabs?.[0];
      if (!activeTab?.id || !activeTab.url?.startsWith('http')) {
        resolve(false);
        return;
      }

      const tabId = activeTab.id;
      const u = payload.username || '';
      const p = payload.password || '';
      const t = payload.totpCode || '';

      // Fallback executor via chrome.scripting
      const executeScriptFallback = () => {
        if (chrome.scripting?.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId },
            func: inPageDirectAutofill,
            args: [u, p, t]
          }).then(() => {
            // Also ensure content.js is injected for subsequent page interactions
            chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            }).catch(() => {});
            resolve(true);
          }).catch(() => {
            resolve(false);
          });
        } else {
          resolve(false);
        }
      };

      try {
        // Attempt 1: Standard message passing to content script
        chrome.tabs.sendMessage(tabId, {
          action: 'autofillCredentials',
          username: u,
          password: p,
          totpCode: t
        }, (response: any) => {
          if (chrome.runtime?.lastError || !response?.success) {
            // Message failed or content script context was invalidated: run scripting fallback
            executeScriptFallback();
          } else {
            resolve(true);
          }
        });
      } catch {
        executeScriptFallback();
      }
    });
  });
}
