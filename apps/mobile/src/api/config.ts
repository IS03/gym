export const DEFAULT_MOBILE_API_TIMEOUT_MS = 15_000;

export type MobileAppEnvironment = 'development' | 'preview' | 'production';

export type MobileApiConfig = {
  appEnv: MobileAppEnvironment;
  baseUrl: string;
  host: string;
  timeoutMs: number;
};

export class MobileApiConfigurationError extends Error {
  constructor() {
    super('Mobile API public configuration is missing or invalid');
    this.name = 'MobileApiConfigurationError';
  }
}

type MobileApiEnvironment = {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_OWNLEVEL_API_URL?: string;
};

export function readMobileApiConfig(
  environment: MobileApiEnvironment = process.env as MobileApiEnvironment,
): MobileApiConfig {
  const configuredUrl = environment.EXPO_PUBLIC_OWNLEVEL_API_URL?.trim() ?? '';
  const configuredAppEnv = environment.EXPO_PUBLIC_APP_ENV?.trim() ?? '';

  if (!configuredUrl || !configuredAppEnv) {
    throw new MobileApiConfigurationError();
  }

  if (
    configuredAppEnv !== 'development' &&
    configuredAppEnv !== 'preview' &&
    configuredAppEnv !== 'production'
  ) {
    throw new MobileApiConfigurationError();
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new MobileApiConfigurationError();
  }

  const localHttp =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (
    (url.protocol !== 'https:' && !localHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new MobileApiConfigurationError();
  }

  return {
    appEnv: configuredAppEnv,
    baseUrl: url.origin,
    host: url.host,
    timeoutMs: DEFAULT_MOBILE_API_TIMEOUT_MS,
  };
}
