/**
 * OWNLEVEL · tema para Expo / React Native.
 *
 * Uso:
 *   const t = useTheme();
 *   <View style={{ backgroundColor: t.colors.bg }}>
 *     <Text style={[t.type.title1, { color: t.colors.text }]}>Rutina push</Text>
 *     <Text style={[t.type.headline, t.numeric, { color: t.colors.text }]}>102,5 kg × 8</Text>
 *   </View>
 *
 * - Sigue el modo del sistema (oscuro/claro). En app.json: "userInterfaceStyle": "automatic".
 * - SF Pro: no se carga nada; fontFamily queda sin definir = fuente del sistema.
 * - Los números SIEMPRE con `t.numeric` (cifras tabulares) para que no bailen.
 * - El hero usa degradado: <LinearGradient colors={t.heroGradient} /> (expo-linear-gradient).
 * - Radios, espacios y medidas: t.radius.card, t.space.md, t.layout.buttonHeight…
 * - Animaciones (react-native-reanimated): withSpring(v, t.motion.spring),
 *   withTiming(v, { duration: t.motion.duration.fast, easing: Easing.bezier(...t.motion.easing) }).
 * - Vidrio: en iOS 26 usar GlassView de expo-glass-effect o la tab bar nativa;
 *   en Android, t.glass (fondo translúcido + expo-blur), o fondo sólido si el equipo es lento.
 * - Vibración: ver haptics.ts.
 */
import { useColorScheme, type TextStyle } from 'react-native';
import {
  chart,
  glass,
  intensity,
  layout,
  motion,
  palette,
  radius,
  space,
  typeScale,
  type ColorScheme,
  type TypeStyle,
} from './tokens';

const type = Object.fromEntries(
  Object.entries(typeScale).map(([k, v]) => [k, { ...v } as TextStyle]),
) as Record<TypeStyle, TextStyle>;

const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

export function buildTheme(scheme: ColorScheme) {
  const colors = palette[scheme];
  return {
    scheme,
    isDark: scheme === 'dark',
    colors,
    chart: chart[scheme],
    intensity: intensity[scheme],
    heroGradient: [colors.heroFrom, colors.heroTo] as const,
    glass: glass[scheme],
    radius,
    space,
    layout,
    motion,
    type,
    numeric,
  };
}

export type Theme = ReturnType<typeof buildTheme>;

const themes: Record<ColorScheme, Theme> = {
  dark: buildTheme('dark'),
  light: buildTheme('light'),
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return themes[scheme === 'light' ? 'light' : 'dark'];
}
