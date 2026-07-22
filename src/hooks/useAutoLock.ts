import { useEffect, useCallback } from 'react';
import { useVaultStore } from '@/stores/vaultStore';

export function useAutoLock() {
  const vaultState = useVaultStore(state => state.vaultState);
  const autoLockMinutes = useVaultStore(state => state.autoLockMinutes);
  const lockVault = useVaultStore(state => state.lockVault);
  const resetActivity = useVaultStore(state => state.resetActivity);

  const handleActivity = useCallback(() => {
    if (useVaultStore.getState().vaultState === 'unlocked') {
      resetActivity();
    }
  }, [resetActivity]);

  useEffect(() => {
    if (vaultState !== 'unlocked' || autoLockMinutes <= 0) return;

    const checkLock = setInterval(() => {
      const elapsed = Date.now() - useVaultStore.getState().lastActivity;
      const timeout = autoLockMinutes * 60 * 1000;
      if (elapsed >= timeout) {
        lockVault();
      }
    }, 5000); // Check every 5 seconds

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      clearInterval(checkLock);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [vaultState, autoLockMinutes, lockVault, handleActivity]);
}
