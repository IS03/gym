import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { MobileHomeResponse } from '@/api/home';
import type { HistoryDay } from '@/api/history';
import type { QuickOption, QuickOptions } from '@/api/nutrition-quick';
import {
  AppIcon,
  AppText,
  InlineUnavailable,
  SkeletonBlock,
  brandTokens,
  radius,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';

import { HomeAddMenu } from './home-add-menu';
import { formatDecimal, formatInteger } from './format';
import type { HomeResource } from './home-resource';
import { HomeCard } from './home-ui';

/** Existing Nutrition flows reachable from the "+" menu. */
export type HomeMealEntry = 'manual' | 'food' | 'quick';

const OUTER = 132;
const INNER = 104;
const STROKE = 14;

/**
 * Lámina 90 colors, all from the brand tokens: calories = the accent; protein = the lighter
 * champagne (an intensity step in light, heroFrom in dark); carbs = secondary grey; fat = a
 * lighter intensity step.
 */
function useMacroColors() {
  const { colors, isDark } = useOwnlevelTheme();
  const scheme = isDark ? 'dark' : 'light';
  const palette = brandTokens.palette[scheme];
  return {
    calories: colors.primary,
    carbs: colors.textMuted,
    // Dark: a visible step of the intensity scale (the track color would hide the segment).
    fat: isDark ? brandTokens.intensity.dark[2] : brandTokens.intensity.light[1],
    protein: isDark ? palette.heroFrom : brandTokens.intensity.light[2],
    track: colors.surfaceRaised,
  };
}

function Arc({ color, fraction, size, track }: { color: string; fraction: number; size: number; track: string }) {
  const r = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, fraction)) * circumference;
  return (
    <Svg height={size} width={size}>
      <Circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke={track} strokeWidth={STROKE} />
      {filled > 0 ? (
        <Circle cx={size / 2} cy={size / 2} fill="none" origin={`${size / 2}, ${size / 2}`} r={r} rotation={-90}
          stroke={color} strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" strokeWidth={STROKE} />
      ) : null}
    </Svg>
  );
}

/** Concentric rings: outside calories, inside protein; what is left (or over) in the center. */
function Rings({ calories, centerLabel, centerValue, protein }: { calories: number; centerLabel: string; centerValue: string; protein: number }) {
  const colors = useMacroColors();
  return (
    <View accessible accessibilityLabel={`${centerValue} ${centerLabel}`} style={styles.rings} testID="home-calorie-ring">
      <View style={StyleSheet.absoluteFill}><Arc color={colors.calories} fraction={calories} size={OUTER} track={colors.track} /></View>
      <View style={styles.inner}><Arc color={colors.protein} fraction={protein} size={INNER} track={colors.track} /></View>
      <View style={styles.center}>
        <AppText numeric style={styles.centerValue}>{centerValue}</AppText>
        <AppText muted style={styles.centerLabel}>{centerLabel}</AppText>
      </View>
    </View>
  );
}

function Legend({ color, label, target, unit, value }: { color: string; label: string; target: number | null; unit: string; value: string }) {
  return (
    <View style={styles.legend}>
      <View style={styles.legendHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText muted style={styles.legendLabel}>{label}</AppText>
      </View>
      <AppText numeric style={styles.legendValue}>
        {value}
        <AppText muted numeric variant="footnote">{target !== null ? ` / ${formatDecimal(target)} ${unit}` : ` ${unit}`}</AppText>
      </AppText>
    </View>
  );
}

type DayNutrient = 'carbsG' | 'fatG';

/**
 * Grams from today's exact-date read. Nothing logged today is 0 g for the day so far;
 * a failed read is null ("—"); undefined while loading.
 */
function dayNutrient(today: HomeResource<HistoryDay>, key: DayNutrient): number | null | undefined {
  if (today.status === 'loading' && !today.data) return undefined;
  const nutrition = today.data?.nutrition;
  if (!nutrition || nutrition.status !== 'ok') return null;
  if (nutrition.data.dayState !== 'recorded') return 0;
  return nutrition.data.summary[key].knownTotal;
}

/** Share of calories per macro (4/4/9 kcal per gram). null when a macro is unknown or nothing is logged. */
export function calorieSplit(proteinG: number, carbsG: number | null | undefined, fatG: number | null | undefined) {
  if (typeof carbsG !== 'number' || typeof fatG !== 'number') return null;
  const kcal = { protein: proteinG * 4, carbs: carbsG * 4, fat: fatG * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total <= 0) return null;
  return { carbs: kcal.carbs / total, fat: kcal.fat / total, protein: kcal.protein / total };
}

const percent = (share: number) => `${Math.round(share * 100)} %`;

function Split({ carbsG, fatG, proteinG }: { carbsG: number | null | undefined; fatG: number | null | undefined; proteinG: number }) {
  const colors = useMacroColors();
  const split = calorieSplit(proteinG, carbsG, fatG);
  const grams = (value: number | null | undefined) => (value === undefined ? null : value === null ? '—' : `${formatDecimal(Math.round(value))} g`);
  const items = [
    { color: colors.protein, key: 'protein', label: 'Proteína', share: split?.protein, value: grams(proteinG) },
    { color: colors.carbs, key: 'carbs', label: 'Carbos', share: split?.carbs, value: grams(carbsG) },
    { color: colors.fat, key: 'fat', label: 'Grasas', share: split?.fat, value: grams(fatG) },
  ];
  return (
    <View style={styles.split} testID="home-calorie-split">
      <AppText muted variant="footnote">Reparto de calorías</AppText>
      <View accessibilityLabel={split ? items.map(item => `${item.label} ${percent(item.share!)}`).join(', ') : 'Sin reparto todavía'}
        accessible style={[styles.splitBar, { backgroundColor: colors.track }]}>
        {split ? items.map(item => <View key={item.key} style={{ backgroundColor: item.color, flex: item.share }} testID={`home-split-${item.key}`} />) : null}
      </View>
      <View style={styles.splitItems}>
        {items.map(item => (
          <View key={item.key} style={styles.splitItem}>
            <View style={styles.legendHead}>
              <View style={[styles.square, { backgroundColor: item.color }]} />
              <AppText muted variant="caption">{item.label}</AppText>
            </View>
            {item.value === null ? <SkeletonBlock height={16} width={48} /> : (
              <AppText numeric style={styles.splitValue}>
                {item.value}
                {item.share !== undefined ? <AppText muted numeric variant="caption">{` · ${percent(item.share)}`}</AppText> : null}
              </AppText>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Habituals: the server's frequency-ordered suggestions first, then saved meals. */
export function homeHabituals(options: QuickOptions | undefined, limit = 2): QuickOption[] {
  if (!options) return [];
  const suggested = options.suggested.status === 'ok' ? options.suggested.items : [];
  const saved = options.saved.status === 'ok' ? options.saved.items : [];
  return [...suggested, ...saved].slice(0, limit);
}

export function HomeNutrition({
  home, onConfigure, onMealEntry, onQuickMeal, quick, today,
}: {
  home: HomeResource<MobileHomeResponse>;
  onConfigure: () => void;
  onMealEntry: (entry: HomeMealEntry) => void;
  onQuickMeal: (option: QuickOption) => void;
  quick: HomeResource<QuickOptions>;
  today: HomeResource<HistoryDay>;
}) {
  const { colors } = useOwnlevelTheme();
  const macroColors = useMacroColors();
  const nutrition = home.data?.nutrition;
  const header = (
    <View style={styles.header}>
      <View style={styles.title}>
        <AppIcon color={colors.primary} name="nutrition" size={16} />
        <AppText accessibilityRole="header" style={[styles.titleText, { color: colors.primary }]}>Nutrición</AppText>
      </View>
      <HomeAddMenu habituals={homeHabituals(quick.data)} onAll={() => onMealEntry('quick')} onFood={() => onMealEntry('food')}
        onHabitual={onQuickMeal} onManual={() => onMealEntry('manual')} />
    </View>
  );
  if (!nutrition) {
    return <HomeCard testID="home-nutrition-loading">{header}<SkeletonBlock height={OUTER} /><SkeletonBlock height={48} /></HomeCard>;
  }
  if (nutrition.status === 'unavailable') {
    return <HomeCard testID="home-nutrition">{header}<InlineUnavailable message="No pudimos cargar Nutrición." /></HomeCard>;
  }
  const n = nutrition.data;
  const target = n.calorieTarget;
  const over = target !== null && n.calories > target;
  // Nothing logged yet is 0 for the day so far: empty rings and the whole target left.
  return (
    <HomeCard testID="home-nutrition">
      {header}
      <View style={styles.body}>
        <Rings
          calories={target !== null && target > 0 ? n.calories / target : target === 0 ? 1 : 0}
          centerLabel={target === null ? 'consumidas' : over ? 'de más' : 'restantes'}
          centerValue={formatInteger(target === null ? n.calories : Math.abs(target - n.calories))}
          protein={n.proteinTargetG !== null && n.proteinTargetG > 0 ? n.proteinG / n.proteinTargetG : 0}
        />
        <View style={styles.legends}>
          <Legend color={macroColors.calories} label="Calorías" target={target} unit="kcal" value={formatInteger(n.calories)} />
          <Legend color={macroColors.protein} label="Proteína" target={n.proteinTargetG} unit="g" value={formatDecimal(Math.round(n.proteinG))} />
        </View>
      </View>
      {target === null ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onConfigure} style={styles.link}>
          <AppText style={{ color: colors.primary }} variant="subheadline">Configurá tu objetivo de calorías</AppText>
          <AppIcon color={colors.primary} name="chevronRight" size={15} />
        </Pressable>
      ) : null}
      <Split carbsG={dayNutrient(today, 'carbsG')} fatG={dayNutrient(today, 'fatG')} proteinG={n.proteinG} />
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  center: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  centerLabel: { fontSize: 11, lineHeight: 13 },
  centerValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 26 },
  dot: { borderRadius: radius.full, height: 8, width: 8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 32 },
  inner: { left: (OUTER - INNER) / 2, position: 'absolute', top: (OUTER - INNER) / 2 },
  legend: { gap: 1 },
  legendHead: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendLabel: { fontSize: 13, fontWeight: '600' },
  legendValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 27 },
  legends: { flex: 1, gap: spacing.md, minWidth: 140 },
  link: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2, minHeight: 32 },
  rings: { height: OUTER, width: OUTER },
  split: { gap: spacing.sm },
  splitBar: { borderRadius: radius.full, flexDirection: 'row', gap: 2, height: 10, overflow: 'hidden' },
  splitItem: { flex: 1, gap: 2, minWidth: 0 },
  splitItems: { flexDirection: 'row', gap: spacing.sm },
  splitValue: { fontSize: 15, fontWeight: '600' },
  square: { borderRadius: 2, height: 8, width: 8 },
  title: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  titleText: { fontSize: 15, fontWeight: '600' },
});
