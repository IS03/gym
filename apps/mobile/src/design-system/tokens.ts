import type { TextStyle } from 'react-native';

const palette = {
  white: '#FFFFFF',
  ink: '#17131F',
  violet500: '#7C3AED',
  violet300: '#A78BFA',
  red500: '#DC3748',
  amber500: '#B76A00',
} as const;

export const lightColors = {
  background: '#F8F7FB',
  surface: palette.white,
  surfaceRaised: '#F0EDF5',
  text: palette.ink,
  textMuted: '#696273',
  border: '#DDD8E4',
  primary: palette.violet500,
  onPrimary: palette.white,
  danger: palette.red500,
  warning: palette.amber500,
  unavailable: '#8A8392',
} as const;

export const darkColors = {
  background: '#0D0B12',
  surface: '#17131F',
  surfaceRaised: '#211B2B',
  text: '#F7F3FB',
  textMuted: '#B8AFBF',
  border: '#352E3E',
  primary: palette.violet300,
  onPrimary: '#1C102F',
  danger: '#FF7A88',
  warning: '#F2B35E',
  unavailable: '#918A99',
} as const;

export type ThemeColors = {
  [Key in keyof typeof lightColors]: string;
};

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const sizes = {
  touchTarget: 44,
  contentMaxWidth: 720,
  separator: 1,
} as const;

type TypographyToken = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'letterSpacing' | 'lineHeight'>;

export const typography = {
  display: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 30,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 23,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  overline: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    lineHeight: 16,
  },
} as const satisfies Record<string, TypographyToken>;
