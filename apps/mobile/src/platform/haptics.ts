import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

function run(effect: () => Promise<void>): void {
  if (Platform.OS === 'web') {
    return;
  }

  void effect().catch(() => {
    // Haptics are an enhancement; unsupported hardware must not block navigation.
  });
}

export const haptics = {
  selection(): void {
    run(() => ExpoHaptics.selectionAsync());
  },
  success(): void {
    run(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    run(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning));
  },
};
