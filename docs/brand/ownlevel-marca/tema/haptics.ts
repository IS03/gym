/**
 * OWNLEVEL · vibración (80 B · Nativo).
 *
 * Uso: haptic('setComplete') al terminar una serie, haptic('restEnd') al terminar el descanso, etc.
 * Respeta la preferencia del usuario: llamá setHapticsEnabled(false) desde Ajustes.
 */
import * as Haptics from 'expo-haptics';
import { hapticsMap, type HapticEvent } from './tokens';

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export async function haptic(event: HapticEvent): Promise<void> {
  if (!enabled) return;
  try {
    switch (hapticsMap[event]) {
      case 'selection':
        return await Haptics.selectionAsync();
      case 'impactMedium':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'impactHeavy':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'error':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // Sin motor de vibración (web, simulador): no hacer nada.
  }
}
