import { Pressable, StyleSheet, View } from 'react-native';

import type { HistoryDay } from '@/api/history';
import type { NutritionDayMetric } from '@/api/nutrition-day';
import {
  AppIcon,
  AppText,
  SectionHeader,
  SkeletonBlock,
  pressedStyle,
  radius,
  spacing,
  useOwnlevelTheme,
  useReduceMotion,
  type AppIconName,
} from '@/design-system';

import type { HomeResource } from './home-resource';

export type HomeRegisterTarget = { kind: 'weight' } | { kind: 'metric'; metricId: string } | { kind: 'more' };

const METRIC_ICONS: Record<NonNullable<NutritionDayMetric['systemKey']>, AppIconName> = {
  mate: 'mug',
  sleep: 'moon',
  steps: 'footprints',
  water: 'water',
};

/** The two shortcut metrics: the first two active ones, in the user's own order. */
export function registerMetrics(day: HistoryDay | undefined): NutritionDayMetric[] {
  if (!day || day.metrics.status !== 'ok') return [];
  return day.metrics.data.metrics.filter(metric => metric.isActive).slice(0, 2);
}

function RegisterButton({ done, icon, label, onPress }: { done: boolean; icon: AppIconName; label: string; onPress: () => void }) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityHint={done ? 'Ya lo registraste hoy' : undefined}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.surface, borderColor: colors.border }, pressedStyle(pressed, reduceMotion)]}
    >
      <AppIcon color={done ? colors.primary : colors.textMuted} name={done ? 'check' : icon} size={20} />
      <AppText style={styles.label} variant="subheadline">{label}</AppText>
    </Pressable>
  );
}

export function HomeRegister({ date, onRegister, today }: { date: string; onRegister: (target: HomeRegisterTarget) => void; today: HomeResource<HistoryDay> }) {
  const day = today.data;
  const weightPending = today.status === 'ready' && day?.date === date && day.body.weight.status === 'ok' && day.body.weight.data === null;
  const metrics = registerMetrics(day);
  return (
    <View style={styles.section} testID="home-register">
      <SectionHeader title="Registrar" />
      <View style={styles.row}>
        {!day && today.status === 'loading'
          ? <><SkeletonBlock height={44} style={styles.skeleton} width={undefined} /><SkeletonBlock height={44} style={styles.skeleton} width={undefined} /></>
          : metrics.map(metric => (
            <RegisterButton done={metric.value !== null} icon={metric.systemKey ? METRIC_ICONS[metric.systemKey] : 'activity'} key={metric.id}
              label={metric.label} onPress={() => onRegister({ kind: 'metric', metricId: metric.id })} />
          ))}
        <RegisterButton done={false} icon="more" label="Más métricas" onPress={() => onRegister({ kind: 'more' })} />
        {weightPending ? <RegisterButton done={false} icon="scale" label="Peso" onPress={() => onRegister({ kind: 'weight' })} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center', borderRadius: radius.button, borderWidth: StyleSheet.hairlineWidth, flexGrow: 1, flexDirection: 'row', gap: spacing.sm,
    justifyContent: 'center', minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  label: { flexShrink: 1, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md },
  skeleton: { borderRadius: radius.button, flex: 1, minWidth: 76 },
});
