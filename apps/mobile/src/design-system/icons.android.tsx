import { View } from 'react-native';

import { lucideIcons, LUCIDE_STROKE_WIDTH } from './icon-lucide';
import type { AppIconProps } from './icon-names';

export { appIconSize } from './icon-names';
export type { AppIconName, AppIconProps } from './icon-names';

// Android: Lucide (stroke 2) per IDENTIDAD.md. Same API as icons.tsx (SF Symbols on iOS).
export function AppIcon({ accessibilityLabel, color, name, size = 20 }: AppIconProps) {
  const Icon = lucideIcons[name];
  return (
    <View
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessible={Boolean(accessibilityLabel)}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      <Icon color={color} size={size} strokeWidth={LUCIDE_STROKE_WIDTH} />
    </View>
  );
}
