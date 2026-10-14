import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Ensure standard WebCrypto is available on both globalThis and window (JSDOM)
const nativeCrypto = (globalThis.crypto && (globalThis.crypto as any).subtle) ? globalThis.crypto : webcrypto;

if (!globalThis.crypto || !(globalThis.crypto as any).subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: nativeCrypto,
    writable: true,
    configurable: true,
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: nativeCrypto,
    writable: true,
    configurable: true,
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}
