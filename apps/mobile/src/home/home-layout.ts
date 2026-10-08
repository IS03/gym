import { brandTokens } from '@/design-system';

/**
 * Home vertical rhythm (Home V3). Values are multiples of 4; the horizontal gutter is the
 * brand screen padding. Each Home block applies the gutter itself so the Nutrition band can
 * run edge to edge.
 */
export const homeLayout = {
  gutter: brandTokens.layout.screenPadding,
  /** Between blocks: today's training → Nutrición → Esta semana → Métricas → Progreso. */
  sectionGap: 52,
  /** Section title → its first content (visible gap). */
  titleToContent: 16,
  /** "Hoy" header → today's training. */
  headerToToday: 32,
  /** Esta semana: linear calendar → "Calorías por día". */
  calendarToCalories: 24,
  /** Extra space after the last block, above the floating tab bar inset. */
  bottomExtra: 24,
  band: {
    /** Vertical fade at each edge of the band (transparent → solid → transparent). */
    fade: 48,
    /** Includes the fade: the title starts 16 below the solid color. */
    paddingTop: 64,
    paddingBottom: 64,
    /** Previous block's end → band edge; with the padding, 84 to "Nutrición". */
    gapBefore: 20,
    /** Band edge → next section title; with the padding, 84 from the band's content. */
    gapAfter: 20,
    caloriesToBar: 12,
    barToProtein: 20,
    proteinToBar: 8,
    proteinBarToLegend: 20,
    legendPaddingTop: 16,
  },
} as const;

/** Section headers are 44 pt tall (touch target) around a 28 pt title: 8 pt of slack per side. */
export const HEADER_SLACK = (brandTokens.layout.minTouch - brandTokens.typeScale.title2.lineHeight) / 2;
