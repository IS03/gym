import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import { Button, ScrollScreen, UnavailableState } from '@/design-system';
import { ActiveSessionScreen } from './active-session-screen';

// Keep the established route/export while replacing the bridge with native core.
export function ActiveSessionBridgeScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { client } = useMobileApi();
  const { session } = useMobileAuth();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  if (!client || !session?.user.id || !id) return <ScrollScreen glow={false}>
    <UnavailableState title="Sesión no disponible" description="No pudimos validar el acceso a esta sesión."
      action={<Button label="Volver a Entrenar" onPress={() => router.replace('/(tabs)/train')} />} />
  </ScrollScreen>;
  return <ActiveSessionScreen key={`${session.user.id}:${id}`} client={client} userId={session.user.id} sessionId={id} />;
}
