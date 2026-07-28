/**
 * SafeVault Zero-Knowledge Breach Check Utility
 * Uses HaveIBeenPwned API range check (k-Anonymity)
 */

export async function hashPasswordSHA1(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function checkPasswordBreach(password: string): Promise<number> {
  if (!password) return 0;
  try {
    const hash = await hashPasswordSHA1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) return 0;

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [lineSuffix, countStr] = line.split(':');
      if (lineSuffix.trim() === suffix) {
        return parseInt(countStr.trim(), 10);
      }
    }
    return 0;
  } catch (err) {
    console.error('Breach check error:', err);
    return 0;
  }
}
