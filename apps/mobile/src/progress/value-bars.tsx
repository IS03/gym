import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, radius, spacing, useOwnlevelTheme } from '@/design-system';

export type ValueBar = { key: string; label: string; value: number | null; text: string; detail?: string; onPress?: () => void; accessibilityHint?: string };

export type BarGeometry = { kind: 'missing' } | { kind: 'zero' } | { kind: 'bar'; start: number; width: number };

/**
 * Faithful bar geometry on a linear scale that always includes 0 (IDENTIDAD.md §
 * Gráficos): lengths are proportional to the values, 0 draws no bar, negatives extend
 * left of the zero line, and a missing value (null) is a gap, never 0. No minimum
 * visual magnitude: a small value looks small. `start`/`width` are fractions (0–1).
 */
export function barGeometry(values: readonly (number | null)[]): BarGeometry[] {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const low = Math.min(0, ...known), high = Math.max(0, ...known);
  const span = high - low;
  const zero = span === 0 || low === 0 ? 0 : -low / span;
  return values.map(value => {
    if (value === null || !Number.isFinite(value)) return { kind: 'missing' };
    if (value === 0 || span === 0) return { kind: 'zero' };
    const end = (value - low) / span;
    return { kind: 'bar', start: Math.min(zero, end), width: Math.abs(end - zero) };
  });
}

/**
 * Minimal, exact chart: one row per real point/bucket. Missing = visible gap with its
 * "Sin dato" text; unavailable reads are handled by the caller (no chart at all).
 */
export function ValueBars({ bars, testID }: { bars: ValueBar[]; testID?: string }) {
  const { colors } = useOwnlevelTheme();
  const geometry = barGeometry(bars.map(b => b.value));
  return <View testID={testID} style={styles.list}>
    {bars.map((b, index) => {
      const g = geometry[index];
      const content = <>
        <AppText variant="caption">{b.label}</AppText>
        <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
          {g.kind === 'bar' ? <View testID={`${testID ?? 'value-bars'}-bar-${b.key}`}
            style={[styles.fill, { left: `${g.start * 100}%`, width: `${g.width * 100}%`, backgroundColor: colors.primary }]} /> : null}
        </View>
        <AppText muted={b.value === null} numeric variant="caption">{b.text}{b.detail ? ` · ${b.detail}` : ''}</AppText>
      </>;
      return b.onPress
        ? <Pressable key={b.key} accessibilityRole="button" accessibilityLabel={`${b.label}: ${b.text}`} accessibilityHint={b.accessibilityHint} onPress={b.onPress} style={styles.row}>{content}</Pressable>
        : <View key={b.key} accessible accessibilityLabel={`${b.label}: ${b.text}`} style={styles.row}>{content}</View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  track: { borderRadius: radius.full, height: 8, overflow: 'hidden' },
  fill: { borderRadius: radius.full, height: '100%', position: 'absolute' },
});
