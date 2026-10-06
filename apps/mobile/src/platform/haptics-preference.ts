// Device preference for vibration (IDENTIDAD.md: "La vibración se puede apagar desde
// los Ajustes de la app"). Local only, default ON. Independent from Reduce Motion.
export const HAPTICS_PREFERENCE_KEY = 'ownlevel.haptics.v1';

export type HapticsPreferenceStorage = { read: () => Promise<boolean | null>; write: (enabled: boolean) => Promise<void> };
type StoragePort = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

/** Unknown or corrupt values read as "no preference" (default ON). */
export function createHapticsPreferenceStorage(port: StoragePort): HapticsPreferenceStorage {
  return {
    read: async () => {
      const raw = await port.getItem(HAPTICS_PREFERENCE_KEY);
      return raw === 'on' ? true : raw === 'off' ? false : null;
    },
    write: enabled => port.setItem(HAPTICS_PREFERENCE_KEY, enabled ? 'on' : 'off'),
  };
}
