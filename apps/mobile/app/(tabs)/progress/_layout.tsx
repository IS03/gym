import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/navigation/use-stack-screen-options';

export default function ProgressLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: 'Progreso' }} />
      <Stack.Screen name="body" options={{ title: 'Cuerpo' }} />
      <Stack.Screen name="metrics" options={{ title: 'Métricas diarias' }} />
      <Stack.Screen name="trends/body" options={{ title: 'Tendencias de Cuerpo' }} />
      <Stack.Screen name="trends/metrics" options={{ title: 'Tendencias de Métricas' }} />
    </Stack>
  );
}
