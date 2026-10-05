import type { MobileApiClient } from './client';
import {
  parseDisplayNameReceipt, parseProfileIdentity, type DisplayNameIntent,
} from '../../../../src/lib/mobile-api/profile-identity-contract';

export * from '../../../../src/lib/mobile-api/profile-identity-contract';
const PATH = '/api/mobile/v1/profile';
export const fetchProfileIdentity = (client: MobileApiClient, signal?: AbortSignal) =>
  client.read({ path: PATH, signal, parse: parseProfileIdentity });
export const updateDisplayName = (client: MobileApiClient, intent: DisplayNameIntent, signal?: AbortSignal) =>
  client.request({ method: 'PATCH', path: PATH, body: intent, signal, parse: parseDisplayNameReceipt });
