import {
  KeychainAccess,
  SecureStorage,
  type SecureStoragePlugin,
} from "@aparajita/capacitor-secure-storage";
import { Capacitor } from "@capacitor/core";
import type { SupportedStorage } from "@supabase/supabase-js";

const AUTH_KEY_PREFIX = "ownlevel-auth_";

export type MobileAuthStorage = SupportedStorage & {
  clear: () => Promise<void>;
};

let mobileAuthStorage: MobileAuthStorage | null = null;

export function createMemoryAuthStorage(): MobileAuthStorage {
  const values = new Map<string, string>();

  return {
    clear: async () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

export function createNativeAuthStorage(
  secureStorage: SecureStoragePlugin = SecureStorage,
): MobileAuthStorage {
  const ready = Promise.all([
    secureStorage.setKeyPrefix(AUTH_KEY_PREFIX),
    secureStorage.setSynchronize(false),
    secureStorage.setDefaultKeychainAccess(
      KeychainAccess.whenUnlockedThisDeviceOnly,
    ),
  ]);

  return {
    async clear() {
      await ready;
      await secureStorage.clear(false);
    },
    async getItem(key) {
      await ready;
      return secureStorage.getItem(key);
    },
    async setItem(key, value) {
      await ready;
      await secureStorage.setItem(key, value);
    },
    async removeItem(key) {
      await ready;
      await secureStorage.removeItem(key);
    },
  };
}

export function getMobileAuthStorage(): MobileAuthStorage {
  if (!mobileAuthStorage) {
    mobileAuthStorage = Capacitor.isNativePlatform()
      ? createNativeAuthStorage()
      : createMemoryAuthStorage();
  }

  return mobileAuthStorage;
}
