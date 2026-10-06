import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { AppText, spacing, useOwnlevelTheme } from '@/design-system';
import { triggerHaptic } from '@/platform/haptics';

const THUMB = 28;

/**
 * iOS-style stepped slider. Unanswered (null) shows no thumb: a tap or drag
 * records a value (0 included), "Quitar" returns it to null. Never defaults to 0.
 */
export function SummarySlider({ field, label, minimumLabel, value, minimum, maximum, disabled, onChange }: {
  field: string; label: string; minimumLabel?: string; value: number | null; minimum: number; maximum: number; disabled: boolean; onChange: (next: number | null) => void;
}) {
  const { colors } = useOwnlevelTheme();
  const [width, setWidth] = useState(0);
  // Rebuilt each render: RNGH updates same-type handlers in place, so an
  // active drag keeps going with the latest value/onChange.
  const select = (x: number) => {
    const ratio = Math.min(Math.max((x - THUMB / 2) / Math.max(width - THUMB, 1), 0), 1);
    const next = minimum + Math.round(ratio * (maximum - minimum));
    if (next === value) return;
    triggerHaptic('stepperChange'); onChange(next);
  };
  const pan = Gesture.Pan().withTestId(`summary-${field}-pan`).enabled(!disabled && width > 0).runOnJS(true)
    .activeOffsetX([-4, 4]).failOffsetY([-12, 12]).onStart(event => select(event.x)).onUpdate(event => select(event.x));
  const tap = Gesture.Tap().withTestId(`summary-${field}-tap`).enabled(!disabled && width > 0).runOnJS(true)
    .onEnd((event, success) => { if (success) select(event.x); });
  const gesture = Gesture.Race(pan, tap);
  const step = (direction: 1 | -1) => {
    if (value === null) { if (direction === 1) onChange(minimum); return; }
    const next = Math.min(Math.max(value + direction, minimum), maximum);
    if (next !== value) onChange(next);
  };
  const ratio = value === null ? 0 : (value - minimum) / (maximum - minimum);
  const travel = Math.max(width - THUMB, 0);
  return <View style={[styles.root, { opacity: disabled ? 0.5 : 1 }]}>
    <View style={styles.header}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.headerValue}>
        {value !== null && !disabled ? <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${label.toLowerCase()}`} hitSlop={12}
          onPress={() => onChange(null)}><AppText style={{ color: colors.primary }} variant="caption">Quitar</AppText></Pressable> : null}
        <AppText muted={value === null} variant={value === null ? 'caption' : 'label'}>{value === null ? 'Sin responder' : `${value}/${maximum}`}</AppText>
      </View>
    </View>
    <GestureDetector gesture={gesture}>
      <View testID={`summary-${field}-slider`} style={styles.hitArea} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        accessible accessibilityRole="adjustable" accessibilityLabel={`${label}, de ${minimum} a ${maximum}`}
        accessibilityState={{ disabled }} accessibilityValue={value === null ? { text: 'Sin responder' } : { min: minimum, max: maximum, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => { if (!disabled) step(event.nativeEvent.actionName === 'increment' ? 1 : -1); }}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          {value !== null ? <View style={[styles.fill, { width: ratio * travel, backgroundColor: colors.primary }]} /> : null}
        </View>
        {value !== null ? <View pointerEvents="none" style={[styles.thumb, { left: ratio * travel }]} /> : null}
      </View>
    </GestureDetector>
    <View style={styles.scaleLabels}>
      <AppText muted variant="caption">{minimumLabel ? `${minimum} · ${minimumLabel}` : minimum}</AppText>
      <AppText muted variant="caption">{maximum}</AppText>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headerValue: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  hitArea: { height: 44, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, marginHorizontal: THUMB / 2, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
