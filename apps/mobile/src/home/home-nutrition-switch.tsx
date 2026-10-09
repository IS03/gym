import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, typography, useOwnlevelTheme, type AppTextVariant } from '@/design-system';

/** Align digit places, not whole totals. The target and units never enter the reel. */
export function nutritionReelSlots(value: string, alternate: string) {
  const before = /^([\d.,+-]+)(.*)$/.exec(value);
  const after = /^([\d.,+-]+)(.*)$/.exec(alternate);
  if (!before || !after || before[2] !== after[2]) return null;
  const length = Math.max(before[1].length, after[1].length);
  const old = before[1].padStart(length, ' ');
  const next = after[1].padStart(length, ' ');
  return { suffix: before[2], slots: Array.from(old, (glyph, index) => ({ old: glyph, next: next[index] })) };
}

function NutritionDigitReels({ alternate, color, direction, progress, remaining, testID, value, variant }: {
  alternate: string; color: string; direction: number; progress: Animated.Value; remaining: boolean;
  testID: string; value: string; variant: AppTextVariant;
}) {
  const { fontScale } = useWindowDimensions();
  const model = nutritionReelSlots(value, alternate)!;
  const height = (typography[variant].lineHeight ?? 22) * fontScale;
  const textStyle = { color };
  return <View accessible accessibilityLabel={remaining ? alternate : value} style={styles.reels} testID={testID}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.reels}>
      {model.slots.map((slot, index) => {
        const id = `${testID}-slot-${index}`;
        const digit = /\d/.test(slot.old + slot.next);
        if (slot.old === slot.next) return <AppText key={index} numeric style={textStyle} testID={id} variant={variant}>{slot.old}</AppText>;
        // Units start first; adjacent places follow within the shared 300 ms transition.
        // Native transforms only: no per-frame React state or interpolated nutrition totals.
        const delay = digit ? Math.min(0.18, (model.slots.length - 1 - index) * 0.045) : 0;
        const end = 0.82 + delay;
        const interpolate = (from: number, to: number) => progress.interpolate({ inputRange: [delay, end], outputRange: [from, to], extrapolate: 'clamp' });
        return <View key={index} style={styles.clip} testID={id}>
          <AppText numeric style={[textStyle, styles.measure]} variant={variant}>{digit ? '8' : slot.old.trim() || slot.next}</AppText>
          <Animated.View style={[styles.layer, {
            opacity: interpolate(1, 0),
            transform: digit ? [{ translateY: interpolate(0, -height * direction) }] : [],
          }]} testID={`${id}-consumed`}>
            <AppText numeric style={textStyle} variant={variant}>{slot.old}</AppText>
          </Animated.View>
          <Animated.View style={[styles.layer, {
            opacity: interpolate(0, 1),
            transform: digit ? [{ translateY: interpolate(height * direction, 0) }] : [],
          }]} testID={`${id}-remaining`}>
            <AppText numeric style={textStyle} variant={variant}>{slot.next}</AppText>
          </Animated.View>
        </View>;
      })}
      {model.suffix ? <AppText numeric style={textStyle} testID={`${testID}-suffix`} variant={variant}>{model.suffix}</AppText> : null}
    </View>
  </View>;
}

/** Two exact values, never interpolated nutrition totals. Shared progress keeps all fields in sync. */
export function NutritionSwitchText({ alternate, color, direction = 1, numeric = false, progress, reduced, remaining, testID, value, variant }: {
  alternate: string; color?: string; direction?: number; numeric?: boolean; progress: Animated.Value;
  reduced: boolean; remaining: boolean; testID: string; value: string; variant: AppTextVariant;
}) {
  const { colors } = useOwnlevelTheme();
  // Passing an undefined color overrides AppText's theme on iOS (black even in dark mode).
  const textStyle = { color: color ?? colors.text };
  const interpolate = (from: number, to: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [from, to], extrapolate: 'clamp' });
  const outgoing = {
    opacity: interpolate(1, 0),
    transform: reduced ? [] : numeric ? [{ translateY: interpolate(0, -24 * direction) }] : [{ translateX: interpolate(0, -8) }],
  };
  const incoming = {
    opacity: interpolate(0, 1),
    transform: reduced ? [] : numeric ? [{ translateY: interpolate(24 * direction, 0) }] : [{ translateX: interpolate(8, 0) }],
  };
  if (value === alternate) return <AppText numeric={numeric} style={textStyle} testID={testID} variant={variant}>{value}</AppText>;
  if (numeric && !reduced && nutritionReelSlots(value, alternate)) return <NutritionDigitReels alternate={alternate} color={textStyle.color}
    direction={direction} progress={progress} remaining={remaining} testID={testID} value={value} variant={variant} />;
  return (
    <View style={styles.clip} testID={testID}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.measure}>
        <AppText numeric={numeric} style={textStyle} variant={variant}>{value.length >= alternate.length ? value : alternate}</AppText>
      </View>
      <Animated.View accessibilityElementsHidden={remaining} importantForAccessibility={remaining ? 'no-hide-descendants' : 'auto'}
        style={[styles.layer, outgoing]} testID={`${testID}-consumed`}>
        <AppText numeric={numeric} style={textStyle} variant={variant}>{value}</AppText>
      </Animated.View>
      <Animated.View accessibilityElementsHidden={!remaining} importantForAccessibility={remaining ? 'auto' : 'no-hide-descendants'}
        style={[styles.layer, incoming]} testID={`${testID}-remaining`}>
        <AppText numeric={numeric} style={textStyle} variant={variant}>{alternate}</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  reels: { alignItems: 'center', flexDirection: 'row', flexShrink: 1 },
  clip: { flexShrink: 1, overflow: 'hidden' },
  layer: { left: 0, position: 'absolute', right: 0, top: 0 },
  measure: { opacity: 0 },
});
