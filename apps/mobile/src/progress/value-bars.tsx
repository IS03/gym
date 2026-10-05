import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, spacing, useOwnlevelTheme } from '@/design-system';

export type ValueBar = { key: string; label: string; value: number | null; text: string; detail?: string; onPress?: () => void; accessibilityHint?: string };
/**
 * Minimal, exact chart: one row per real point/bucket, bar length relative to the
 * visible range. A missing value is a visible gap ("Sin dato"), never 0 and never
 * interpolated. M9 may replace the visuals; the data contract stays.
 */
export function ValueBars({ bars, testID }: { bars: ValueBar[]; testID?: string }) {
  const { colors } = useOwnlevelTheme();
  const known = bars.flatMap(b => b.value === null ? [] : [b.value]);
  const min = known.length ? Math.min(...known) : 0, max = known.length ? Math.max(...known) : 0;
  // Bars start at the range minimum (with a floor) so small real changes stay visible.
  const share = (v: number) => max === min ? 1 : 0.15 + 0.85 * (v - min) / (max - min);
  return <View testID={testID} style={styles.list}>
    {bars.map(b => {
      const content = <>
        <AppText variant="caption">{b.label}</AppText>
        <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
          {b.value === null ? null : <View style={{ width: `${share(b.value) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}
        </View>
        <AppText muted={b.value === null} variant="caption">{b.text}{b.detail ? ` · ${b.detail}` : ''}</AppText>
      </>;
      return b.onPress
        ? <Pressable key={b.key} accessibilityRole="button" accessibilityLabel={`${b.label}: ${b.text}`} accessibilityHint={b.accessibilityHint} onPress={b.onPress} style={styles.row}>{content}</Pressable>
        : <View key={b.key} accessible accessibilityLabel={`${b.label}: ${b.text}`} style={styles.row}>{content}</View>;
    })}
  </View>;
}
const styles = StyleSheet.create({ list: { gap: spacing.sm }, row: { gap: 4 }, track: { height: 8, borderRadius: 4, overflow: 'hidden' } });
