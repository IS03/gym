import { useEffect, useSyncExternalStore } from 'react';

// On iOS 26 a tap outside the anchored confirmation closes it and still reaches the view below
// (it opened "Ver sesión" or "Nueva sesión"). While one is open, screens stop taking touches.
const RELEASE_MS = 300;
let openCount = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Holds the lock while `open`; the release waits for the dismissing tap to end. */
export function useHoldStartConfirmLock(open: boolean) {
  useEffect(() => {
    if (!open) return undefined;
    openCount += 1;
    emit();
    return () => {
      setTimeout(() => { openCount -= 1; emit(); }, RELEASE_MS);
    };
  }, [open]);
}

/** `pointerEvents` for a screen's content: 'none' while a start confirmation is open. */
export function useStartConfirmPointerEvents(): 'auto' | 'none' {
  return useSyncExternalStore(subscribe, () => (openCount > 0 ? 'none' : 'auto'));
}
