import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useMobileAuth } from '@/auth';
import { callbackUrlFromRouteParameters } from '@/auth/callback';
import { LoadingState, Screen } from '@/design-system';

export default function AuthCallbackScreen() {
  const parameters = useLocalSearchParams<Record<string, string | string[]>>();
  const { handleCallbackUrl } = useMobileAuth();
  const callbackUrl = useMemo(
    () => callbackUrlFromRouteParameters(parameters),
    [parameters],
  );

  useEffect(() => {
    void handleCallbackUrl(callbackUrl);
  }, [callbackUrl, handleCallbackUrl]);

  return (
    <Screen centered>
      <LoadingState label="Completando inicio de sesión" />
    </Screen>
  );
}
