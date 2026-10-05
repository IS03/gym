import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/navigation/use-stack-screen-options';

export default function SettingsLayout() {
  return <Stack screenOptions={useStackScreenOptions()}>
    <Stack.Screen name="index" options={{ title: 'Ajustes' }} />
    <Stack.Screen name="metrics" options={{ title: 'Métricas' }} />
    <Stack.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />
  </Stack>;
}
