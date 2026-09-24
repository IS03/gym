import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

export type AppIconName =
  | 'activity'
  | 'brand'
  | 'calendar'
  | 'check'
  | 'chevronRight'
  | 'clock'
  | 'dumbbell'
  | 'flame'
  | 'nutrition'
  | 'profile'
  | 'progress'
  | 'refresh'
  | 'routines'
  | 'settings'
  | 'warning'
  | 'water';

const iconNames: Record<
  AppIconName,
  { ios: SFSymbol; android: AndroidSymbol }
> = {
  activity: { ios: 'bolt.fill', android: 'bolt' },
  brand: {
    ios: 'figure.strengthtraining.traditional',
    android: 'fitness_center',
  },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  clock: { ios: 'clock.fill', android: 'schedule' },
  dumbbell: { ios: 'dumbbell.fill', android: 'fitness_center' },
  flame: { ios: 'flame.fill', android: 'local_fire_department' },
  nutrition: { ios: 'fork.knife', android: 'restaurant' },
  profile: { ios: 'person.fill', android: 'person' },
  progress: { ios: 'chart.line.uptrend.xyaxis', android: 'show_chart' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  routines: { ios: 'list.bullet.rectangle', android: 'list_alt' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  warning: {
    ios: 'exclamationmark.triangle.fill',
    android: 'warning',
  },
  water: { ios: 'drop.fill', android: 'water_drop' },
};

type AppIconProps = {
  accessibilityLabel?: string;
  color: string;
  name: AppIconName;
  size?: number;
};

export function AppIcon({
  accessibilityLabel,
  color,
  name,
  size = 20,
}: AppIconProps) {
  return (
    <SymbolView
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      importantForAccessibility={
        accessibilityLabel ? 'auto' : 'no-hide-descendants'
      }
      name={iconNames[name]}
      size={size}
      tintColor={color}
    />
  );
}
