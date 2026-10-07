import { Pressable, StyleSheet, View } from 'react-native';

import type { HistoryDay } from '@/api/history';
import type { NutritionDayMetric } from '@/api/nutrition-day';
import {
  AppIcon,
  AppText,
  SkeletonBlock,
  pressedStyle,
  radius,
  spacing,
  useOwnlevelTheme,
  useReduceMotion,
  type AppIconName,
} from '@/design-system';

import { metricValue } from '@/nutrition/day-content';

import type { HomeResource } from './home-resource';
import { HomeSectionHeader } from './home-ui';

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

/** One shortcut: a 54 pt circle, its name and today's state; a check badge when it is logged today. */
function RegisterCircle({ detail, done, icon, label, onPress, testID }: {
  detail: string | null; done: boolean; icon: AppIconName; label: string; onPress: () => void; testID?: string;
}) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityHint={done ? 'Ya lo registraste hoy' : 'Abre la carga de hoy'}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressedStyle(pressed, reduceMotion)]}
      testID={testID}
    >
      <View style={[styles.circle, { backgroundColor: colors.surface }]}>
        <AppIcon color={done ? colors.textMuted : colors.primary} name={icon} size={22} />
        {done ? (
          <View style={[styles.badge, { backgroundColor: colors.background }]}>
            <AppIcon color={colors.primary} name="check" size={18} />
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={1} style={styles.label}>{label}</AppText>
      {detail === null ? <SkeletonBlock height={12} width={36} /> : (
        <AppText muted numberOfLines={1} numeric style={styles.detail}>{detail}</AppText>
      )}
    </Pressable>
  );
}

export function HomeRegister({ date, onRegister, today }: { date: string; onRegister: (target: HomeRegisterTarget) => void; today: HomeResource<HistoryDay> }) {
  // Only a confirmed read of today says what is (not) logged today; anything else stays
  // unknown ("—", no check): a stale or previous-day read never claims a state.
  const day = today.data?.date === date ? today.data : undefined;
  const confirmed = today.status === 'ready' && !!day;
  const loading = !day && today.status === 'loading';
  const weight = confirmed && day!.body.weight.status === 'ok' ? day!.body.weight.data : undefined;
  // The weight value lives in Progreso; here only whether today's is logged.
  const weightDetail = loading ? null : weight ? 'Cargado' : weight === null ? 'Cargar' : '—';
  const metrics = registerMetrics(day);
  return (
    <View style={styles.section} testID="home-register">
      <HomeSectionHeader title="Registrar" />
      <View style={styles.row}>
        <RegisterCircle detail={weightDetail} done={!!weight} icon="scale" label="Peso" onPress={() => onRegister({ kind: 'weight' })} testID="home-register-weight" />
        {loading
          ? <><RegisterCircle detail={null} done={false} icon="activity" label=" " onPress={() => undefined} /><RegisterCircle detail={null} done={false} icon="activity" label=" " onPress={() => undefined} /></>
          : metrics.map(metric => (
            <RegisterCircle detail={!confirmed ? '—' : metric.value === null ? 'Cargar' : metricValue(metric, metric.value)} done={confirmed && metric.value !== null}
              icon={metric.systemKey ? METRIC_ICONS[metric.systemKey] : 'activity'} key={metric.id} label={metric.label}
              onPress={() => onRegister({ kind: 'metric', metricId: metric.id })} />
          ))}
        <RegisterCircle detail="Métricas" done={false} icon="more" label="Más" onPress={() => onRegister({ kind: 'more' })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, bottom: -4, padding: 1, position: 'absolute', right: -4 },
  circle: { alignItems: 'center', borderRadius: radius.full, height: 54, justifyContent: 'center', width: 54 },
  detail: { fontSize: 12, textAlign: 'center' },
  item: { alignItems: 'center', flexBasis: 72, flexGrow: 1, gap: 6, minHeight: 44 },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  section: { gap: spacing.md },
});
