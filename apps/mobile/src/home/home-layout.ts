import { brandTokens } from '@/design-system';

/**
 * Home vertical rhythm. Blocks sit on the screen background, inside the brand gutter.
 */
export const homeLayout = {
  gutter: brandTokens.layout.screenPadding,
  /** Between blocks: today's training → Nutrición → Esta semana → Métricas → Progreso. */
  sectionGap: 32,
  /** Section title → its first content (visible gap). */
  titleToContent: 16,
  /** "Hoy" header → today's training. */
  headerToToday: 32,
  /** Extra space after the last block, above the floating tab bar inset. */
  bottomExtra: 24,
  band: {
    paddingTop: 0,
    paddingBottom: 0,
    gapBefore: 32,
    gapAfter: 32,
    caloriesToBar: 12,
    barToProtein: 20,
    proteinToBar: 8,
    proteinBarToLegend: 20,
    legendPaddingTop: 16,
  },
} as const;

/** Section headers are 44 pt tall (touch target) around a 28 pt title: 8 pt of slack per side. */
export const HEADER_SLACK = (brandTokens.layout.minTouch - brandTokens.typeScale.title2.lineHeight) / 2;
