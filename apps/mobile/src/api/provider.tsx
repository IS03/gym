import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';

import { useMobileAuth } from '@/auth';

import { createMobileApiClient, type MobileApiClient } from './client';
import { readMobileApiConfig, type MobileApiConfig } from './config';
import { createMobileClientRuntime, type MobileClientRuntime } from './runtime';

type MobileApiContextValue = {
  client: MobileApiClient | null;
  config: MobileApiConfig | null;
  configurationError: boolean;
  runtime: MobileClientRuntime | null;
};

const MobileApiContext = createContext<MobileApiContextValue | null>(null);

export function MobileApiProvider({ children }: PropsWithChildren) {
  const { getAccessTokenForApi, revalidateApiSession } = useMobileAuth();

  const value = useMemo<MobileApiContextValue>(() => {
    try {
      const config = readMobileApiConfig();
      const runtime = createMobileClientRuntime();
      return {
        client: createMobileApiClient({
          auth: {
            getAccessToken: getAccessTokenForApi,
            revalidateAfterUnauthorized: revalidateApiSession,
          },
          config,
          runtime,
        }),
        config,
        configurationError: false,
        runtime,
      };
    } catch {
      return {
        client: null,
        config: null,
        configurationError: true,
        runtime: null,
      };
    }
  }, [getAccessTokenForApi, revalidateApiSession]);

  return <MobileApiContext.Provider value={value}>{children}</MobileApiContext.Provider>;
}

export function useMobileApi(): MobileApiContextValue {
  const value = useContext(MobileApiContext);
  if (!value) {
    throw new Error('useMobileApi must be used inside MobileApiProvider');
  }
  return value;
}
