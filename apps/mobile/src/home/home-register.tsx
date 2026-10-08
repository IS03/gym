import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

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
import { HomeSection } from './home-ui';

/** Only daily metrics: weight and body measurements live in Progreso (Cuerpo). */
export type HomeRegisterTarget = { kind: 'metric'; metricId: string } | { kind: 'more' };

const METRIC_ICONS: Record<NonNullable<NutritionDayMetric['systemKey']>, AppIconName> = {
  mate: 'mug',
  sleep: 'moon',
  steps: 'footprints',
  water: 'water',
};

/** All active metrics, in the user's own order. The viewport, not the data, is limited. */
export function registerMetrics(day: HistoryDay | undefined): NutritionDayMetric[] {
  if (!day || day.metrics.status !== 'ok') return [];
  return day.metrics.data.metrics.filter(metric => metric.isActive);
}

/** One shortcut: a 48 pt circle, its name and today's state; a check badge when it is logged today. */
function RegisterCircle({ detail, done, glass, icon, label, onPress, testID, width }: {
  detail: string | null; done: boolean; glass: boolean; icon: AppIconName; label: string; onPress: () => void; testID?: string; width: number;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  const image = <AppIcon color={colors.textMuted} name={icon} size={20} />;
  return (
    <Pressable
      accessibilityHint={done ? 'Ya lo registraste hoy' : 'Abre la carga de hoy'}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, { width }, pressedStyle(pressed, reduceMotion)]}
      testID={testID}
    >
      <View style={styles.circleWrap}>
        {glass ? <GlassView colorScheme={isDark ? 'dark' : 'light'} glassEffectStyle="regular" isInteractive style={styles.circle} testID={`${testID}-glass`}>{image}</GlassView>
          : <View style={[styles.circle, { backgroundColor: colors.surface }]}>{image}</View>}
        {done ? (
          <View style={[styles.badge, { backgroundColor: colors.background }]}>
            <AppIcon color={colors.primary} name="check" size={17} />
          </View>
        ) : null}
      </View>
      <AppText style={styles.label} variant="subheadline">{label}</AppText>
      {detail === null ? <SkeletonBlock height={14} width={40} /> : (
        <AppText muted numeric style={styles.detail} variant="footnote">{detail}</AppText>
      )}
    </Pressable>
  );
}

export function HomeRegister({ date, onRegister, today }: { date: string; onRegister: (target: HomeRegisterTarget) => void; today: HomeResource<HistoryDay> }) {
  const supported = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (alive) setReduceTransparency(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => { if (alive) setReduceTransparency(value); });
    return () => { alive = false; subscription.remove(); };
  }, [supported]);
  const glass = supported && !reduceTransparency;
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, window.width - 32));
  // Only a confirmed read of today says what is (not) logged today; anything else stays
  // unknown ("—", no check): a stale or previous-day read never claims a state.
  const day = today.data?.date === date ? today.data : undefined;
  const confirmed = today.status === 'ready' && !!day;
  const loading = !day && today.status === 'loading';
  const metrics = registerMetrics(day);
  const slots = loading ? 3 : Math.min(metrics.length + 1, 4);
  const itemWidth = Math.max(window.fontScale > 1.5 ? 112 : 72, width / slots);
  return (
    <HomeSection testID="home-register" title="Métricas">
      <View onLayout={event => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }} style={styles.row}>
        <ScrollView accessibilityHint="Deslizá para ver más métricas" contentContainerStyle={styles.scrollContent} decelerationRate="fast"
          directionalLockEnabled horizontal nestedScrollEnabled showsHorizontalScrollIndicator={metrics.length > 3}
          style={styles.scroll} testID="home-register-scroll">
        {loading
          ? <><RegisterCircle detail={null} done={false} glass={false} icon="activity" label=" " onPress={() => undefined} width={itemWidth} /><RegisterCircle detail={null} done={false} glass={false} icon="activity" label=" " onPress={() => undefined} width={itemWidth} /></>
          : metrics.map(metric => (
            <RegisterCircle detail={!confirmed ? '—' : metric.value === null ? 'Cargar' : metricValue(metric, metric.value)} done={confirmed && metric.value !== null}
              glass={glass} icon={metric.systemKey ? METRIC_ICONS[metric.systemKey] : 'activity'} key={metric.id} label={metric.label}
              onPress={() => onRegister({ kind: 'metric', metricId: metric.id })} testID={`home-register-metric-${metric.id}`} width={itemWidth} />
          ))}
        </ScrollView>
        <View style={styles.fixedMore} testID="home-register-fixed-more">
          <RegisterCircle detail="Métricas" done={false} glass={glass} icon="more" label="Más" onPress={() => onRegister({ kind: 'more' })} testID="home-register-more" width={itemWidth} />
        </View>
      </View>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, bottom: -4, padding: 1, position: 'absolute', right: -4 },
  circle: { alignItems: 'center', borderRadius: radius.full, height: 48, justifyContent: 'center', width: 48 },
  circleWrap: { height: 48, marginBottom: 2, width: 48 },
  detail: { textAlign: 'center' },
  fixedMore: { paddingBottom: spacing.sm, paddingTop: spacing.xs },
  item: { alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: spacing.xs },
  label: { fontWeight: '600', textAlign: 'center' },
  row: { alignItems: 'flex-start', flexDirection: 'row', paddingTop: spacing.xs },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'flex-start', paddingBottom: spacing.sm, paddingTop: spacing.xs },
});
