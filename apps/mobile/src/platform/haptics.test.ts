import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as ExpoHaptics from 'expo-haptics';

import { hapticsMap, type HapticEvent } from '@/design-system/brand';

import { haptics, hapticsPreference, initHapticsPreference, resetHapticsForTests, setHapticsEnabled, triggerHaptic } from './haptics';
import { createHapticsPreferenceStorage, HAPTICS_PREFERENCE_KEY } from './haptics-preference';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
const H = jest.mocked(ExpoHaptics);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function memory(initial?: string) {
  const store = new Map<string, string>(initial === undefined ? [] : [[HAPTICS_PREFERENCE_KEY, initial]]);
  return { store, port: { getItem: jest.fn(async (k: string) => store.get(k) ?? null), setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }) } };
}

describe('Brand haptics', () => {
  beforeEach(() => { resetHapticsForTests(); });

  it('maps every official brand event to its expo-haptics call', () => {
    const expected: Record<HapticEvent, () => void> = {
      stepperChange: () => expect(H.selectionAsync).toHaveBeenCalledTimes(1),
      setComplete: () => expect(H.impactAsync).toHaveBeenCalledWith('medium'),
      restEnd: () => expect(H.impactAsync).toHaveBeenCalledWith('heavy'),
      personalRecord: () => expect(H.notificationAsync).toHaveBeenCalledWith('success'),
      workoutComplete: () => expect(H.notificationAsync).toHaveBeenCalledWith('success'),
      systemError: () => expect(H.notificationAsync).toHaveBeenCalledWith('error'),
    };
    expect(Object.keys(expected).sort()).toEqual(Object.keys(hapticsMap).sort());
    for (const event of Object.keys(hapticsMap) as HapticEvent[]) {
      jest.clearAllMocks();
      triggerHaptic(event);
      expected[event]();
    }
  });

  it('success only for record/workout and error only for system errors', () => {
    expect(Object.entries(hapticsMap).filter(([, type]) => type === 'success').map(([event]) => event).sort()).toEqual(['personalRecord', 'workoutComplete']);
    expect(Object.entries(hapticsMap).filter(([, type]) => type === 'error').map(([event]) => event)).toEqual(['systemError']);
  });

  it('disabled = no call (brand events and legacy tics)', async () => {
    await setHapticsEnabled(false);
    triggerHaptic('workoutComplete'); haptics.selection();
    expect(H.notificationAsync).not.toHaveBeenCalled();
    expect(H.selectionAsync).not.toHaveBeenCalled();
  });

  it('hardware/API failures never break the flow', async () => {
    H.impactAsync.mockRejectedValueOnce(new Error('no engine'));
    expect(() => triggerHaptic('setComplete')).not.toThrow();
    H.notificationAsync.mockImplementationOnce(() => { throw new Error('sync failure'); });
    expect(() => triggerHaptic('systemError')).not.toThrow();
    await tick();
  });

  it('preference: default ON, saved off restored, corrupt ignored, persisted on change, failures flagged', async () => {
    expect(hapticsPreference().enabled).toBe(true);
    const off = memory('off');
    initHapticsPreference(createHapticsPreferenceStorage(off.port)); await tick();
    expect(hapticsPreference().enabled).toBe(false);

    resetHapticsForTests();
    initHapticsPreference(createHapticsPreferenceStorage(memory('maybe').port)); await tick();
    expect(hapticsPreference().enabled).toBe(true);

    resetHapticsForTests();
    const saved = memory();
    initHapticsPreference(createHapticsPreferenceStorage(saved.port)); await tick();
    await setHapticsEnabled(false);
    expect(saved.store.get(HAPTICS_PREFERENCE_KEY)).toBe('off');

    saved.port.setItem.mockRejectedValueOnce(new Error('disk full'));
    await setHapticsEnabled(true);
    expect(hapticsPreference()).toEqual({ enabled: true, persistenceFailed: true });
  });

  it('a late stored value never overrides a choice made meanwhile', async () => {
    let release!: (v: string | null) => void;
    const port = { getItem: jest.fn(() => new Promise<string | null>(r => { release = r; })), setItem: jest.fn(async () => undefined) };
    initHapticsPreference(createHapticsPreferenceStorage(port));
    await setHapticsEnabled(false);
    release('on'); await tick();
    expect(hapticsPreference().enabled).toBe(false);
  });
});
