import type { SFSymbol } from 'expo-symbols';

// Semantic icon names used by the app. Screens only use these via <AppIcon>;
// the platform implementation (SF Symbols on iOS, Lucide on Android) lives in
// icons.tsx / icons.android.tsx (IDENTIDAD.md § Íconos).
export type AppIconName =
  | 'activity'
  | 'brand'
  | 'calendar'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'clock'
  | 'close'
  | 'dumbbell'
  | 'flame'
  | 'filter'
  | 'nutrition'
  | 'note'
  | 'profile'
  | 'progress'
  | 'refresh'
  | 'routines'
  | 'settings'
  | 'warning'
  | 'water';

export type AppIconProps = {
  accessibilityLabel?: string;
  color: string;
  name: AppIconName;
  size?: number;
};

/** IDENTIDAD.md § Íconos (not part of tokens.ts): tab bar 24, rows and buttons 20, next to Body text 17. */
export const appIconSize = { tabBar: 24, row: 20, inline: 17 } as const;

export const sfSymbolNames: Record<AppIconName, SFSymbol> = {
  activity: 'bolt.fill',
  // Temporary until the brand isotype replaces it (M9.1D).
  brand: 'figure.strengthtraining.traditional',
  calendar: 'calendar',
  check: 'checkmark.circle.fill',
  chevronLeft: 'chevron.left',
  chevronRight: 'chevron.right',
  clock: 'clock.fill',
  close: 'xmark',
  dumbbell: 'dumbbell.fill',
  flame: 'flame.fill',
  filter: 'line.3.horizontal.decrease',
  nutrition: 'fork.knife',
  note: 'note.text',
  profile: 'person.fill',
  progress: 'chart.line.uptrend.xyaxis',
  refresh: 'arrow.clockwise',
  routines: 'list.bullet.rectangle',
  settings: 'gearshape.fill',
  warning: 'exclamationmark.triangle.fill',
  water: 'drop.fill',
};
