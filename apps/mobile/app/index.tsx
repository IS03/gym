import { Redirect } from 'expo-router';

import { useMobileAuth } from '@/auth';

export default function IndexRoute() {
  const { session, state } = useMobileAuth();

  if (state.status === 'BOOTSTRAPPING') {
    return null;
  }

  return <Redirect href={session ? '/(tabs)/home' : '/(auth)/sign-in'} />;
}
