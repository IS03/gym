import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { MobileHomeResponse } from '@/api/home';
import type { HistoryDay } from '@/api/history';
import type { QuickOption, QuickOptions } from '@/api/nutrition-quick';
import {
  AppIcon,
  AppText,
  InlineUnavailable,
  ProgressBar,
  SkeletonBlock,
  Surface,
  pressedStyle,
  radius,
  spacing,
  useOwnlevelTheme,
  useReduceMotion,
} from '@/design-system';

import { formatDecimal, formatInteger } from './format';
import type { HomeResource } from './home-resource';

const RING = 104;
const STROKE = 10;

/** Ring of the day's calories: consumed / target, full (same color) when over. */
function CalorieRing({ fraction, label, value }: { fraction: number; label: string; value: string }) {
  const { colors } = useOwnlevelTheme();
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, fraction)) * circumference;
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.ring} testID="home-calorie-ring">
      <Svg height={RING} width={RING}>
        <Circle cx={RING / 2} cy={RING / 2} fill="none" r={r} stroke={colors.surfaceRaised} strokeWidth={STROKE} />
        {filled > 0 ? (
          <Circle
            cx={RING / 2} cy={RING / 2} fill="none" r={r} rotation={-90} origin={`${RING / 2}, ${RING / 2}`}
            stroke={colors.primary} strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" strokeWidth={STROKE}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter}>
        <AppText numeric style={styles.ringValue}>{value}</AppText>
        <AppText muted style={styles.ringLabel} variant="caption">{label}</AppText>
      </View>
    </View>
  );
}

/** No meals yet: a dashed ring with "—", never 0 kcal. */
function EmptyRing() {
  const { colors } = useOwnlevelTheme();
  const r = (RING - 2) / 2;
  return (
    <View accessibilityElementsHidden style={styles.ring} testID="home-calorie-ring-empty">
      <Svg height={RING} width={RING}>
        <Circle cx={RING / 2} cy={RING / 2} fill="none" r={r} stroke={colors.surfaceRaised} strokeDasharray="4 6" strokeWidth={2} />
      </Svg>
      <View style={styles.ringCenter}><AppText muted style={styles.ringValue}>—</AppText></View>
    </View>
  );
}

/** grams: number = known value; null = no data ("—"); undefined = still loading. */
function MacroRow({ grams, label, target }: { grams: number | null | undefined; label: string; target?: number | null }) {
  const value = grams === undefined ? null : grams === null ? '—' : formatDecimal(Math.round(grams));
  const hasTarget = target !== undefined && target !== null;
  return (
    <View style={styles.macro}>
      <View style={styles.macroLine}>
        <AppText muted variant="footnote">{label}</AppText>
        {value === null ? <SkeletonBlock height={14} width={44} /> : (
          <AppText numeric variant="subheadline" style={styles.macroValue}>
            {value}
            <AppText muted variant="caption">{hasTarget ? ` / ${formatDecimal(target)} g` : grams === null ? '' : ' g'}</AppText>
          </AppText>
        )}
      </View>
      {hasTarget && target > 0 && typeof grams === 'number' ? (
        <ProgressBar accessibilityLabel={`${label}: ${value} de ${formatDecimal(target)} gramos`} maximumValue={target} value={grams} />
      ) : null}
    </View>
  );
}

type DayNutrient = 'carbsG' | 'fatG';

/** Grams from today's exact-date read; null when every meal lacks the value or the read failed. */
function dayNutrient(today: HomeResource<HistoryDay>, key: DayNutrient): number | null | undefined {
  if (today.status === 'loading' && !today.data) return undefined;
  const nutrition = today.data?.nutrition;
  if (!nutrition || nutrition.status !== 'ok' || nutrition.data.dayState !== 'recorded') return null;
  const total = nutrition.data.summary[key];
  const entries = nutrition.data.summary.entryCount;
  if (entries > 0 && total.missingCount === entries) return null;
  return total.knownTotal;
}

/** Habituals: the server's frequency-ordered suggestions first, then saved meals. */
export function homeHabituals(options: QuickOptions | undefined, limit = 2): QuickOption[] {
  if (!options) return [];
  const suggested = options.suggested.status === 'ok' ? options.suggested.items : [];
  const saved = options.saved.status === 'ok' ? options.saved.items : [];
  return [...suggested, ...saved].slice(0, limit);
}

function QuickChip({ icon, label, onPress, accessibilityHint }: { icon: 'plus' | 'refresh'; label: string; onPress: () => void; accessibilityHint: string }) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  return (
    <Pressable accessibilityHint={accessibilityHint} accessibilityLabel={label} accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: colors.surfaceRaised }, pressedStyle(pressed, reduceMotion)]}>
      <AppIcon color={colors.primary} name={icon} size={15} />
      <AppText numberOfLines={1} variant="subheadline" style={styles.chipLabel}>{label}</AppText>
    </Pressable>
  );
}

export function HomeNutrition({
  home, onConfigure, onNewMeal, onQuickMeal, quick, today,
}: {
  home: HomeResource<MobileHomeResponse>;
  onConfigure: () => void;
  onNewMeal: () => void;
  onQuickMeal: (option: QuickOption) => void;
  quick: HomeResource<QuickOptions>;
  today: HomeResource<HistoryDay>;
}) {
  const { colors } = useOwnlevelTheme();
  const nutrition = home.data?.nutrition;
  if (!nutrition) {
    return <Surface testID="home-nutrition-loading"><SkeletonBlock height={22} width="40%" /><SkeletonBlock height={104} /><SkeletonBlock height={36} /></Surface>;
  }
  if (nutrition.status === 'unavailable') {
    return (
      <Surface testID="home-nutrition">
        <AppText accessibilityRole="header" variant="headline">Nutrición</AppText>
        <InlineUnavailable message="No pudimos cargar Nutrición." />
      </Surface>
    );
  }
  const n = nutrition.data;
  const empty = n.mealCount === 0;
  const target = n.calorieTarget;
  const headerDetail = empty
    ? target !== null ? `objetivo ${formatInteger(target)} kcal` : ''
    : target !== null ? `${formatInteger(n.calories)} de ${formatInteger(target)} kcal` : `${formatInteger(n.calories)} kcal`;
  const over = target !== null && n.calories > target;
  const habituals = homeHabituals(quick.data);

  return (
    <Surface testID="home-nutrition">
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="headline">Nutrición</AppText>
        {headerDetail ? <AppText muted numeric variant="footnote">{headerDetail}</AppText> : null}
      </View>
      {empty ? (
        <View style={styles.body}>
          <EmptyRing />
          <View style={styles.flex}>
            <AppText variant="headline">Todavía no cargaste comidas hoy</AppText>
            <AppText muted variant="footnote">Cuando registres la primera, acá vas a ver cuánto te queda.</AppText>
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          {target === null ? (
            <CalorieRing fraction={0} label="kcal consumidas" value={formatInteger(n.calories)} />
          ) : (
            <CalorieRing
              fraction={target > 0 ? n.calories / target : 1}
              label={over ? 'kcal sobre el objetivo' : 'kcal restantes'}
              value={formatInteger(Math.abs(target - n.calories))}
            />
          )}
          <View style={styles.macros}>
            <MacroRow grams={n.proteinG} label="Proteína" target={n.proteinTargetG} />
            <MacroRow grams={dayNutrient(today, 'carbsG')} label="Carbos" />
            <MacroRow grams={dayNutrient(today, 'fatG')} label="Grasas" />
          </View>
        </View>
      )}
      {target === null ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onConfigure} style={styles.link}>
          <AppText style={{ color: colors.primary }} variant="subheadline">Configurá tu objetivo de calorías</AppText>
          <AppIcon color={colors.primary} name="chevronRight" size={15} />
        </Pressable>
      ) : null}
      <View style={styles.quick}>
        <View style={styles.quickHeader}>
          <AppText muted style={styles.overline} variant="caption">AGREGAR RÁPIDO</AppText>
          {habituals.length ? <AppText muted variant="caption">Habituales</AppText> : null}
        </View>
        <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
          <QuickChip accessibilityHint="Abre la carga de comidas de Nutrición" icon="plus" label="Nueva comida" onPress={onNewMeal} />
          {quick.status === 'loading' && !quick.data ? <SkeletonBlock height={36} width={120} style={styles.chipSkeleton} /> : null}
          {habituals.map(option => (
            <QuickChip accessibilityHint="Abre la carga rápida con esta comida" icon="refresh" key={`${option.source.kind}:${option.source.id}`}
              label={option.name} onPress={() => onQuickMeal(option)} />
          ))}
        </ScrollView>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  chip: { alignItems: 'center', borderRadius: radius.chip, flexDirection: 'row', gap: 6, maxWidth: 220, minHeight: 36, paddingHorizontal: spacing.md },
  chipLabel: { flexShrink: 1, fontWeight: '600' },
  chipSkeleton: { borderRadius: radius.chip },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  flex: { flex: 1, gap: spacing.xs, minWidth: 160 },
  header: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  link: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2, minHeight: 32 },
  macro: { gap: 5 },
  macroLine: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  macroValue: { fontWeight: '600' },
  macros: { flex: 1, gap: 10, minWidth: 150 },
  overline: { letterSpacing: 0.6 },
  quick: { gap: spacing.sm },
  quickHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  ring: { alignItems: 'center', height: RING, justifyContent: 'center', width: RING },
  ringCenter: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 14, position: 'absolute', right: 14, top: 0 },
  ringLabel: { fontSize: 11, lineHeight: 13, textAlign: 'center' },
  ringValue: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
});
