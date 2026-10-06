import type { TextStyle } from 'react-native';

import { layout, palette, radius as brandRadius, space, typeScale } from './brand';

// Mobile adapter over the shared OWNLEVEL brand tokens (packages/brand). Every value
// comes from the brand; this file only maps the design-system names onto it.
// Legacy names are kept so screens keep compiling; M9.2/M9.3 migrate consumers.

type ColorRoles = {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  brandSubtle: string;
  brandSurface: string;
  onBrand: string;
  danger: string;
  /** @deprecated Compatibility alias (= accent). The brand has no "success" color. Remove in M9.2/M9.3. */
  success: string;
  /** @deprecated Compatibility alias (= text, neutral emphasis). The brand has no "warning" color. Remove in M9.2/M9.3. */
  warning: string;
  /** @deprecated Compatibility alias (= textMuted). Remove in M9.2/M9.3. */
  unavailable: string;
};

function colorRoles(scheme: (typeof palette)['dark'] | (typeof palette)['light']): ColorRoles {
  return {
    background: scheme.bg,
    surface: scheme.surface,
    surfaceRaised: scheme.elevated,
    text: scheme.text,
    textMuted: scheme.textMuted,
    border: scheme.border,
    primary: scheme.accent,
    onPrimary: scheme.onAccent,
    brandSubtle: scheme.accentSoft,
    // Hero surfaces stay solid until the hero gradient lands (heroFrom → heroTo).
    brandSurface: scheme.heroFrom,
    onBrand: scheme.onHero,
    // System failures and destructive actions only, never to judge the user's data.
    danger: scheme.error,
    // Neutral/brand compatibility: never green/amber "good/bad".
    success: scheme.accent,
    warning: scheme.text,
    unavailable: scheme.textMuted,
  };
}

export const lightColors = colorRoles(palette.light);
export const darkColors = colorRoles(palette.dark);

export type ThemeColors = ColorRoles;

/**
 * Legacy spacing names mapped onto the brand scale (4, 8, 12, 16, 20, 24, 32, 40).
 * `none` is the absence of spacing. `xxxl` was 48, which is outside the scale:
 * it maps to the largest brand step (40).
 */
export const spacing = {
  none: 0,
  xs: space.xxs,
  sm: space.xs,
  md: space.sm,
  lg: space.md,
  xl: space.xl,
  xxl: space.xxl,
  xxxl: space.xxxl,
} as const;

/**
 * Brand radii (card, inner, button, chip, input, sheet, tabBar, full). Prefer these
 * names in new code. Legacy aliases, by actual use: `sm` = inputs/skeleton → input,
 * `md` = inner elements/buttons → inner, `lg` = surfaces → card, `xl` = hero card → card,
 * `pill` = pills/tracks → full.
 */
export const radius = {
  ...brandRadius,
  sm: brandRadius.input,
  md: brandRadius.inner,
  lg: brandRadius.card,
  xl: brandRadius.card,
  pill: brandRadius.full,
} as const;

export const sizes = {
  touchTarget: layout.minTouch,
  // Mobile-only layout constraints (not brand tokens).
  contentMaxWidth: 720,
  separator: 1,
} as const;

type TypographyToken = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'letterSpacing' | 'lineHeight'>;

/**
 * Legacy roles mapped onto the iOS type scale of the brand. No fontFamily: iOS
 * renders SF Pro, Android Roboto.
 */
export const typography = {
  display: typeScale.largeTitle,
  heading: typeScale.title2,
  body: typeScale.body,
  label: typeScale.headline,
  caption: typeScale.caption,
  /**
   * @deprecated Not part of the brand type scale. Kept for compatibility (caption size,
   * legacy weight/tracking) until M9.2/M9.3 replace it with footnote/caption.
   */
  overline: { ...typeScale.caption, fontWeight: '700', letterSpacing: 1.1 },
} as const satisfies Record<string, TypographyToken>;
