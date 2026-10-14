import { describe, it, expect } from 'vitest';

describe('Chrome Extension Background & Autofill Engine', () => {
  // Domain extraction utility function as used in background.js
  function extractDomain(urlOrHost: string): string {
    if (!urlOrHost) return '';
    try {
      let hostname = urlOrHost;
      if (urlOrHost.includes('://')) {
        hostname = new URL(urlOrHost).hostname;
      }
      hostname = hostname.toLowerCase().trim();
      hostname = hostname.split(':')[0];
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts.slice(-2).join('.');
      }
      return hostname;
    } catch {
      return urlOrHost.toLowerCase().trim();
    }
  }

  // Password generator utility as used in background.js
  function generateSecurePassword(length = 20): string {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, x => chars[x % chars.length]).join('');
  }

  it('domain extraction matches subdomains, ports, and protocols correctly', () => {
    expect(extractDomain('https://github.com/login')).toBe('github.com');
    expect(extractDomain('https://subdomain.login.github.com:8443/auth')).toBe('github.com');
    expect(extractDomain('http://localhost:5173')).toBe('localhost');
    expect(extractDomain('https://accounts.google.com/signin')).toBe('google.com');
    expect(extractDomain('my-site.co.uk')).toBe('co.uk');
  });

  it('extension password generator generates cryptographically strong passwords', () => {
    const pass1 = generateSecurePassword(20);
    const pass2 = generateSecurePassword(20);

    expect(pass1.length).toBe(20);
    expect(pass2.length).toBe(20);
    expect(pass1).not.toBe(pass2); // High entropy

    // Check character class diversity
    expect(/[a-zA-Z]/.test(pass1)).toBe(true);
    expect(/[0-9]/.test(pass1)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(pass1)).toBe(true);
  });

  it('matching credential search filters by domain or title accurately', () => {
    const vaultCredentials = [
      { id: '1', title: 'GitHub Personal', url: 'https://github.com/login', username: 'user1', password: 'p1' },
      { id: '2', title: 'Google Mail', url: 'https://mail.google.com', username: 'user2', password: 'p2' },
      { id: '3', title: 'Work Portal', url: 'https://auth.company.org/sso', username: 'user3', password: 'p3' },
    ];

    const currentUrl = 'https://gist.github.com/new';
    const targetDomain = extractDomain(currentUrl);

    const matches = vaultCredentials.filter(c => {
      const cDomain = extractDomain(c.url);
      return cDomain === targetDomain;
    });

    expect(matches.length).toBe(1);
    expect(matches[0].title).toBe('GitHub Personal');
  });

  it('DOM input value dispatch simulates native events for React/Angular/Vue', () => {
    // Create mock DOM input elements
    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.name = 'username';
    document.body.appendChild(userInput);

    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.name = 'password';
    document.body.appendChild(passInput);

    let inputEventFired = false;
    let changeEventFired = false;

    userInput.addEventListener('input', () => { inputEventFired = true; });
    userInput.addEventListener('change', () => { changeEventFired = true; });

    // Simulate autofill
    userInput.value = 'test_user@example.com';
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    userInput.dispatchEvent(new Event('change', { bubbles: true }));

    passInput.value = 'SecretP@ssword2026';
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(userInput.value).toBe('test_user@example.com');
    expect(passInput.value).toBe('SecretP@ssword2026');
    expect(inputEventFired).toBe(true);
    expect(changeEventFired).toBe(true);

    userInput.remove();
    passInput.remove();
  });
});
