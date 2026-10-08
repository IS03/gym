import { Pressable, StyleSheet, View } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { HistoryDay } from '@/api/history';
import type { QuickOption, QuickOptions } from '@/api/nutrition-quick';
import { AppIcon, AppText, InlineUnavailable, SkeletonBlock, atmosphere, brandTokens, fadeGradient, rgba, spacing, useOwnlevelTheme } from '@/design-system';

import { HomeAddMenu } from './home-add-menu';
import { formatDecimal, formatInteger } from './format';
import type { HomeResource } from './home-resource';
import { HEADER_SLACK, homeLayout } from './home-layout';
import { HomeBar, HomeSectionTitle, useHomeGutter } from './home-ui';
import { BigNumber } from './home-week';

/** Existing Nutrition flows reachable from the "+ Comida" menu. */
export type HomeMealEntry = 'manual' | 'food' | 'quick';

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

/** Three columns: grams of each macro and its share of the calories. */
function Legend({ band, carbsG, fatG, proteinG }: { band: BandColors; carbsG: number | null | undefined; fatG: number | null | undefined; proteinG: number }) {
  const split = calorieSplit(proteinG, carbsG, fatG);
  const grams = (value: number | null | undefined) => (value === undefined ? null : value === null ? '—' : `${formatDecimal(Math.round(value))} g`);
  const items = [
    { key: 'protein', label: 'Proteína', share: split?.protein, value: grams(proteinG) },
    { key: 'carbs', label: 'Carbos', share: split?.carbs, value: grams(carbsG) },
    { key: 'fat', label: 'Grasas', share: split?.fat, value: grams(fatG) },
  ];
  return (
    <View style={[styles.legend, { borderTopColor: band.hairline }]} testID="home-calorie-split">
      {items.map(item => (
        <View accessibilityLabel={item.value === null ? undefined : `${item.label}: ${item.value}${item.share !== undefined ? `, ${percent(item.share)} de las calorías` : ''}`}
          accessible={item.value !== null} key={item.key} style={styles.legendItem} testID={`home-split-${item.key}`}>
          <AppText style={{ color: band.textMuted }} variant="footnote">{item.label}</AppText>
          {item.value === null ? <SkeletonBlock height={18} style={{ backgroundColor: band.track }} width={64} /> : (
            <AppText numeric variant="headline">{item.share !== undefined ? `${item.value} · ${percent(item.share)}` : item.value}</AppText>
          )}
        </View>
      ))}
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

type BandColors = { hairline: string; rgb: string; textMuted: string; track: string };

/**
 * Nutrition's band: the glow tone, faded at the top and bottom edges. Tracks, hairline and
 * bars are brand colors; the light band only needs a darker secondary grey for contrast.
 */
function useBandColors(): BandColors {
  const { colors, isDark } = useOwnlevelTheme();
  const scheme = atmosphere[isDark ? 'dark' : 'light'];
  return isDark
    ? { hairline: colors.border, rgb: scheme.band, textMuted: scheme.bandTextMuted ?? colors.textMuted, track: colors.surfaceRaised }
    : { hairline: brandTokens.intensity.light[1], rgb: scheme.band, textMuted: scheme.bandTextMuted ?? colors.textMuted, track: brandTokens.intensity.light[1] };
}

/** Three layers instead of a measured gradient: fade in, solid, fade out. Only the band has alpha. */
function BandBackground({ rgb }: { rgb: string }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.fadeTop, { experimental_backgroundImage: fadeGradient(rgb, 'in') }]} testID="home-band-fade-top" />
      <View pointerEvents="none" style={[styles.solid, { backgroundColor: rgba(rgb, 1) }]} testID="home-band-solid" />
      <View pointerEvents="none" style={[styles.fadeBottom, { experimental_backgroundImage: fadeGradient(rgb, 'out') }]} testID="home-band-fade-bottom" />
    </>
  );
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
  const band = useBandColors();
  const gutter = useHomeGutter();
  const nutrition = home.data?.nutrition;
  // Full-bleed band: edge to edge, no radius, border or shadow; the gutter lives inside.
  return (
    <View style={[styles.band, gutter]} testID={!nutrition ? 'home-nutrition-loading' : 'home-nutrition'}>
      <BandBackground rgb={band.rgb} />
      <HomeSectionTitle title="Nutrición">
        <HomeAddMenu habituals={homeHabituals(quick.data)} onAll={() => onMealEntry('quick')} onFood={() => onMealEntry('food')}
          onHabitual={onQuickMeal} onManual={() => onMealEntry('manual')} />
      </HomeSectionTitle>
      <View style={styles.body}>
        {!nutrition ? (
          <View style={styles.loading}>
            <SkeletonBlock height={41} style={{ backgroundColor: band.track }} width={180} />
            <SkeletonBlock height={8} style={{ backgroundColor: band.track }} />
            <SkeletonBlock height={44} style={{ backgroundColor: band.track }} />
          </View>
        ) : nutrition.status === 'unavailable' ? (
          <InlineUnavailable message="No pudimos cargar Nutrición." />
        ) : (
          <NutritionBody band={band} colors={{ primary: colors.primary, protein: colors.textMuted }} n={nutrition.data} onConfigure={onConfigure} today={today} />
        )}
      </View>
    </View>
  );
}

type NutritionData = Extract<MobileHomeResponse['nutrition'], { status: 'ok' }>['data'];

function NutritionBody({ band, colors, n, onConfigure, today }: {
  band: BandColors; colors: { primary: string; protein: string }; n: NutritionData; onConfigure: () => void; today: HomeResource<HistoryDay>;
}) {
  const target = n.calorieTarget;
  const over = target !== null && n.calories > target;
  const consumed = formatInteger(n.calories);
  const proteinTarget = n.proteinTargetG;
  const protein = formatDecimal(Math.round(n.proteinG));
  // Nothing logged yet is 0 for the day so far: an empty bar and the whole target left.
  const left = target === null ? null : { label: over ? 'de más' : 'restantes', value: formatInteger(Math.abs(target - n.calories)) };
  return (
    <View>
      <View accessible accessibilityLabel={`Calorías consumidas: ${consumed}${target !== null && left ? ` de ${formatInteger(target)} kcal, ${left.value} ${left.label}` : ' kcal'}`}
        style={styles.calories} testID="home-calories">
        <View style={styles.flex}>
          <BigNumber mutedColor={band.textMuted} unit={target !== null ? `/ ${formatInteger(target)} kcal` : 'kcal'} value={consumed} />
          <AppText style={{ color: band.textMuted }} variant="subheadline">Calorías consumidas</AppText>
        </View>
        {left ? (
          <View style={styles.left} testID="home-calories-left">
            <AppText numeric style={{ color: band.textMuted }} variant="subheadline">{left.value}</AppText>
            <AppText style={{ color: band.textMuted }} variant="subheadline">{left.label}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.caloriesBar}>
        {target !== null ? (
          <HomeBar color={colors.primary} fraction={target > 0 ? n.calories / target : 1} height={8} testID="home-calorie-bar" track={band.track} />
        ) : (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onConfigure} style={styles.link}>
            <AppText style={{ color: colors.primary }} variant="subheadline">Configurá tu objetivo de calorías</AppText>
            <AppIcon color={colors.primary} name="chevronRight" size={15} />
          </Pressable>
        )}
      </View>
      <View style={styles.protein}>
        <View accessible accessibilityLabel={`Proteína: ${protein}${proteinTarget !== null ? ` de ${formatDecimal(proteinTarget)} g` : ' g'}`} style={styles.proteinRow}>
          <AppText variant="body">Proteína</AppText>
          <AppText numeric variant="headline">{proteinTarget !== null ? `${protein} / ${formatDecimal(proteinTarget)} g` : `${protein} g`}</AppText>
        </View>
        {proteinTarget !== null ? (
          <View style={styles.proteinBar}>
            <HomeBar color={colors.protein} fraction={proteinTarget > 0 ? n.proteinG / proteinTarget : 1} height={5} testID="home-protein-bar" track={band.track} />
          </View>
        ) : null}
      </View>
      <Legend band={band} carbsG={dayNutrient(today, 'carbsG')} fatG={dayNutrient(today, 'fatG')} proteinG={n.proteinG} />
    </View>
  );
}

const { band } = homeLayout;

const styles = StyleSheet.create({
  band: { paddingBottom: band.paddingBottom, paddingTop: band.paddingTop - HEADER_SLACK },
  fadeBottom: { bottom: 0, height: band.fade, left: 0, position: 'absolute', right: 0 },
  fadeTop: { height: band.fade, left: 0, position: 'absolute', right: 0, top: 0 },
  solid: { bottom: band.fade, left: 0, position: 'absolute', right: 0, top: band.fade },
  body: { marginTop: homeLayout.titleToContent - HEADER_SLACK },
  calories: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  caloriesBar: { marginTop: band.caloriesToBar },
  flex: { flex: 1, minWidth: 0 },
  left: { alignItems: 'flex-end' },
  legend: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, marginTop: band.proteinBarToLegend, paddingTop: band.legendPaddingTop },
  legendItem: { flex: 1, gap: 2, minWidth: 0 },
  link: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2, minHeight: 44 },
  loading: { gap: spacing.md },
  protein: { marginTop: band.barToProtein },
  proteinBar: { marginTop: band.proteinToBar },
  proteinRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
});
