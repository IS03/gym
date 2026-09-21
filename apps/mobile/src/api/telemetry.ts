import type { MobileAppEnvironment } from './config';
import type { MobileApiMethod, MobileApiUnavailableReason } from './results';
import type { MobileClientRuntime } from './runtime';

export type MobileApiTelemetryOutcome =
  | 'auth_required'
  | 'not_found'
  | 'ok'
  | 'unauthorized'
  | 'validation'
  | MobileApiUnavailableReason;

export type MobileApiTelemetryEvent = {
  appEnv: MobileAppEnvironment;
  appVersion: string | null;
  build: string | null;
  durationMs: number;
  httpStatus: number | null;
  method: MobileApiMethod;
  outcome: MobileApiTelemetryOutcome;
  path: string;
  platform: MobileClientRuntime['platform'];
};

export type MobileApiTelemetry = {
  record: (event: MobileApiTelemetryEvent) => void;
};

export function safeTelemetryPath(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? path;
}

export const mobileApiTelemetry: MobileApiTelemetry = {
  record(event) {
    if (__DEV__) {
      console.info('[OWNLEVEL API]', event);
    }
  },
};
