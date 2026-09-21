import { describe, expect, it } from '@jest/globals';

import {
  createMobileClientHeaders,
  createMobileClientRuntime,
  UnsupportedMobilePlatformError,
} from './runtime';

describe('Mobile client runtime', () => {
  it('creates iOS version headers without a Capacitor bridge header', () => {
    const headers = createMobileClientHeaders(
      createMobileClientRuntime('ios', '0.1.0', '7'),
    );

    expect(headers).toEqual({
      'X-OWNLEVEL-App-Version': '0.1.0',
      'X-OWNLEVEL-Build': '7',
      'X-OWNLEVEL-Platform': 'ios',
    });
    expect(headers).not.toHaveProperty('X-OWNLEVEL-Bridge-Version');
  });

  it('supports Android and omits unavailable version values', () => {
    expect(
      createMobileClientHeaders(createMobileClientRuntime('android', null, null)),
    ).toEqual({ 'X-OWNLEVEL-Platform': 'android' });
  });

  it('rejects non-native platforms', () => {
    expect(() => createMobileClientRuntime('web', '0.1.0', '1')).toThrow(
      UnsupportedMobilePlatformError,
    );
  });
});
