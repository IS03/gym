import { useRouter } from 'expo-router';

import { AppText, Button, Heading, Screen, Surface } from '@/design-system';

export default function NavigationQaScreen() {
  const router = useRouter();

  return (
    <Screen centered>
      <Surface>
        <AppText muted variant="overline">
          QA DE NAVEGACIÓN
        </AppText>
        <Heading level={2}>Stack nativo</Heading>
        <AppText>
          Volvé con el botón, con swipe-back en iOS o con el botón físico/gesto de Android.
        </AppText>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </Surface>
    </Screen>
  );
}
