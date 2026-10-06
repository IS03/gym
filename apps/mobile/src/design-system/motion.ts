import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { motion } from './brand';

// Brand motion (IDENTIDAD.md § Movimiento y vibración): 200/300 ms, press to 95 %.
// With Reduce Motion on, nothing scales or slides: only fades/opacity.
export const motionDurations = motion.duration;
export const pressScale = motion.pressScale;

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(value => { if (alive) setReduced(value); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => { alive = false; subscription?.remove(); };
  }, []);
  return reduced;
}

/** Pressed feedback for controls: scale to 95 %, or a fade when Reduce Motion is on. */
export function pressedStyle(pressed: boolean, reduceMotion: boolean) {
  if (!pressed) return null;
  return reduceMotion ? { opacity: 0.7 } : { transform: [{ scale: pressScale }] };
}
