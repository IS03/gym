import { describe, expect, it, vi } from "vitest";
import {
  KeychainAccess,
  type SecureStoragePlugin,
} from "@aparajita/capacitor-secure-storage";

import { createMemoryAuthStorage, createNativeAuthStorage } from "./storage";

describe("mobile auth storage", () => {
  it("uses an ephemeral memory adapter outside the native runtime", async () => {
    const storage = createMemoryAuthStorage();

    await storage.setItem("session", "secret");
    expect(await storage.getItem("session")).toBe("secret");
    await storage.removeItem("session");
    expect(await storage.getItem("session")).toBeNull();
  });

  it("configures device-only Keychain storage before auth access", async () => {
    const values = new Map<string, string>();
    const secureStorage = {
      setKeyPrefix: vi.fn().mockResolvedValue(undefined),
      setSynchronize: vi.fn().mockResolvedValue(undefined),
      setDefaultKeychainAccess: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(async () => {
        values.clear();
      }),
    } as unknown as SecureStoragePlugin;
    const storage = createNativeAuthStorage(secureStorage);

    await storage.setItem("session", "secret");
    expect(await storage.getItem("session")).toBe("secret");
    await storage.removeItem("session");
    expect(await storage.getItem("session")).toBeNull();

    await storage.setItem("session", "secret");
    await storage.clear();
    expect(await storage.getItem("session")).toBeNull();

    expect(secureStorage.setKeyPrefix).toHaveBeenCalledWith("ownlevel-auth_");
    expect(secureStorage.setSynchronize).toHaveBeenCalledWith(false);
    expect(secureStorage.setDefaultKeychainAccess).toHaveBeenCalledWith(
      KeychainAccess.whenUnlockedThisDeviceOnly,
    );
    expect(secureStorage.clear).toHaveBeenCalledWith(false);
  });
});
