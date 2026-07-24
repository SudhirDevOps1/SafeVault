// SafeVault Extension Content Script (Autofill Injection)
function findLoginInputs() {
  const passwordInput = document.querySelector('input[type="password"]');
  let usernameInput = null;

  if (passwordInput) {
    const inputs = Array.from(document.querySelectorAll('input'));
    const passIndex = inputs.indexOf(passwordInput);
    for (let i = passIndex - 1; i >= 0; i--) {
      const type = inputs[i].type;
      if (type === 'text' || type === 'email' || type === 'username') {
        usernameInput = inputs[i];
        break;
      }
    }
  }
  return { usernameInput, passwordInput };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "autofillCredentials") {
    const { username, password } = message;
    const { usernameInput, passwordInput } = findLoginInputs();

    if (usernameInput && username) {
      usernameInput.value = username;
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (passwordInput && password) {
      passwordInput.value = password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    sendResponse({ success: true });
  }
});
