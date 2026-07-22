import { useEffect } from 'react';
import { useVaultStore } from '@/stores/vaultStore';

/**
 * Detects system sleep/hibernate/visibility changes and auto-locks the vault.
 * 
 * Uses:
 * - Page Visibility API (tab/app backgrounding)
 * - Time gap detection (detects wake-from-sleep by large time deltas)
 * - online/offline events
 */
export function useSystemSleepLock() {
  const { vaultState, lockVault } = useVaultStore();

  useEffect(() => {
    if (vaultState !== 'unlocked') return;

    let lastSeen = Date.now();
    const SLEEP_THRESHOLD = 60_000; // 60 seconds gap = likely sleep

    // Time-gap based sleep detection
    const gapChecker = setInterval(() => {
      const now = Date.now();
      const delta = now - lastSeen;
      if (delta > SLEEP_THRESHOLD) {
        lockVault();
      }
      lastSeen = now;
    }, 5000);

    // Page Visibility API - lock when hidden for extended period
    const handleVisibility = () => {
      if (document.hidden) {
        lastSeen = Date.now();
      } else {
        const now = Date.now();
        const delta = now - lastSeen;
        if (delta > SLEEP_THRESHOLD) {
          lockVault();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Wake-from-sleep detection via online event
    const handleOnline = () => {
      const now = Date.now();
      const delta = now - lastSeen;
      if (delta > SLEEP_THRESHOLD) {
        lockVault();
      }
      lastSeen = now;
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(gapChecker);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [vaultState, lockVault]);
}
