import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_MOBILE_API_TIMEOUT_MS,
  MobileApiConfigurationError,
  readMobileApiConfig,
} from './config';

describe('Mobile API config', () => {
  it('normalizes the configured production origin', () => {
    expect(
      readMobileApiConfig({
        EXPO_PUBLIC_APP_ENV: 'development',
        EXPO_PUBLIC_OWNLEVEL_API_URL: 'https://www.ownlevel.fit/',
      }),
    ).toEqual({
      appEnv: 'development',
      baseUrl: 'https://www.ownlevel.fit',
      host: 'www.ownlevel.fit',
      timeoutMs: DEFAULT_MOBILE_API_TIMEOUT_MS,
    });
  });

  it.each([
    {},
    {
      EXPO_PUBLIC_APP_ENV: 'unknown',
      EXPO_PUBLIC_OWNLEVEL_API_URL: 'https://www.ownlevel.fit',
    },
    {
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_OWNLEVEL_API_URL: 'http://www.ownlevel.fit',
    },
    {
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_OWNLEVEL_API_URL: 'https://www.ownlevel.fit/api',
    },
  ])('rejects invalid public configuration', (environment) => {
    expect(() => readMobileApiConfig(environment)).toThrow(
      MobileApiConfigurationError,
    );
  });

  it('allows explicit localhost HTTP for simulator-only development', () => {
    expect(
      readMobileApiConfig({
        EXPO_PUBLIC_APP_ENV: 'development',
        EXPO_PUBLIC_OWNLEVEL_API_URL: 'http://localhost:3000',
      }).baseUrl,
    ).toBe('http://localhost:3000');
  });
});
