import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionStoragePort } from './active-session-storage';

// Separate from Auth's SecureStore. Workout records can exceed Keychain limits.
export const activeSessionStorage: SessionStoragePort = AsyncStorage;
