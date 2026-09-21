import { useRouter } from 'expo-router';

import { AppText, Button, Heading, Row, Screen, Separator, Surface } from '@/design-system';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen centered>
      <Surface>
        <AppText muted variant="overline">
          OWNLEVEL MOBILE
        </AppText>
        <Heading>Foundation</Heading>
        <AppText>El cliente React Native + Expo definitivo está listo para validación técnica.</AppText>
        <Separator />
        <AppText muted variant="caption">
          Sesión nativa protegida. Mobile API y datos reales llegan en los próximos milestones.
        </AppText>
      </Surface>
      <Row>
        <Button label="Probar navegación" onPress={() => router.push('/(tabs)/home/navigation-qa')} />
        <Button label="Ajustes" onPress={() => router.push('/settings')} variant="secondary" />
      </Row>
    </Screen>
  );
}
