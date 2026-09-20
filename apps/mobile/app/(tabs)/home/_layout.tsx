import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/navigation/use-stack-screen-options';

export default function HomeLayout() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Inicio' }} />
      <Stack.Screen name="navigation-qa" options={{ title: 'Navegación' }} />
    </Stack>
  );
}
