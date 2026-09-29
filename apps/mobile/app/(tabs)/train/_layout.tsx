import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/navigation/use-stack-screen-options';

export default function TrainLayout() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="routines" options={{ title: 'Rutinas' }} />
      <Stack.Screen
        name="routines/[id]"
        options={{ headerBackButtonMenuEnabled: false, title: 'Rutinas' }}
      />
      <Stack.Screen name="exercises" options={{ title: 'Biblioteca' }} />
    </Stack>
  );
}
