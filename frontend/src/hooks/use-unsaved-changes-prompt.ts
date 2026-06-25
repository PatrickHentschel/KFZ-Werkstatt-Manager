import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Schützt vor verlorenem Form-Input.
 *
 * - In-App-Navigation: useBlocker (RR6 data router) zeigt Confirm-UI über `blocker.state === 'blocked'`.
 * - Browser-Reload/Tab-Close: window.beforeunload zeigt nativen Browser-Dialog.
 *
 * Verbraucher rendert den Confirm-Dialog selbst und ruft `blocker.proceed()` / `blocker.reset()`.
 */
export function useUnsavedChangesPrompt(isDirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome zeigt dann generischen Dialog; returnValue für ältere Browser
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return blocker;
}
