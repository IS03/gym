import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/navigation/use-stack-screen-options';

export default function TrainLayout() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
