import { SymbolView } from 'expo-symbols';

import { sfSymbolNames, type AppIconProps } from './icon-names';

export { appIconSize } from './icon-names';
export type { AppIconName, AppIconProps } from './icon-names';

// iOS (and default): native SF Symbols through expo-symbols. Android: icons.android.tsx (Lucide).
export function AppIcon({ accessibilityLabel, color, name, size = 20 }: AppIconProps) {
  return (
    <SymbolView
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      importantForAccessibility={accessibilityLabel ? 'auto' : 'no-hide-descendants'}
      name={sfSymbolNames[name]}
      size={size}
      tintColor={color}
    />
  );
}
