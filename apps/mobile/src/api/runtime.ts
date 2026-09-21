import * as Application from 'expo-application';
import { Platform } from 'react-native';

export type MobileApiPlatform = 'android' | 'ios';

export type MobileClientRuntime = {
  appVersion: string | null;
  build: string | null;
  platform: MobileApiPlatform;
};

export type MobileClientHeaders = {
  'X-OWNLEVEL-App-Version'?: string;
  'X-OWNLEVEL-Build'?: string;
  'X-OWNLEVEL-Platform': MobileApiPlatform;
};

export class UnsupportedMobilePlatformError extends Error {
  constructor() {
    super('OWNLEVEL Mobile API requires iOS or Android');
    this.name = 'UnsupportedMobilePlatformError';
  }
}

export function createMobileClientRuntime(
  platform = Platform.OS,
  appVersion = Application.nativeApplicationVersion,
  build = Application.nativeBuildVersion,
): MobileClientRuntime {
  if (platform !== 'ios' && platform !== 'android') {
    throw new UnsupportedMobilePlatformError();
  }

  return {
    appVersion: appVersion?.trim() || null,
    build: build?.trim() || null,
    platform,
  };
}

export function createMobileClientHeaders(
  runtime: MobileClientRuntime,
): MobileClientHeaders {
  return {
    ...(runtime.appVersion
      ? { 'X-OWNLEVEL-App-Version': runtime.appVersion }
      : {}),
    ...(runtime.build ? { 'X-OWNLEVEL-Build': runtime.build } : {}),
    'X-OWNLEVEL-Platform': runtime.platform,
  };
}
