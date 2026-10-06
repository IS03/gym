import { Pressable, StyleSheet, View } from 'react-native';

import { layout } from './brand';
import { pressedStyle, useReduceMotion } from './motion';
import { AppText } from './primitives';
import { radius, spacing } from './tokens';
import { useOwnlevelTheme } from './theme';

// Selection controls: neutral at rest, accentSoft + accent outline when selected.
// No green/red meaning; selection never encodes good/bad.

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** radio = one of a group (default); toggle = independent on/off. */
  kind?: 'radio' | 'toggle';
};

/** Chip: height 34, radius 10 (IDENTIDAD.md § Sistema). */
export function Chip({ accessibilityLabel, disabled = false, kind = 'radio', label, onPress, selected }: ChipProps) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={kind === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      hitSlop={(layout.minTouch - layout.chipHeight) / 2}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.brandSubtle : colors.surfaceRaised,
          borderColor: selected ? colors.primary : 'transparent',
        },
        disabled && styles.disabled,
        pressedStyle(pressed && !disabled, reduceMotion),
      ]}
    >
      <AppText style={selected ? styles.selectedText : null} variant="subheadline">{label}</AppText>
    </Pressable>
  );
}

export type SelectionOption<T extends string> = { value: T; label: string };

type GroupProps<T extends string> = {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
  options: readonly SelectionOption<T>[];
  value: T | null;
};

/** Single choice as chips (wraps on small screens). */
export function ChipGroup<T extends string>({ accessibilityLabel, disabled, onChange, options, value }: GroupProps<T>) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.group}>
      {options.map(option => (
        <Chip key={option.value} disabled={disabled} label={option.label} onPress={() => onChange(option.value)} selected={option.value === value} />
      ))}
    </View>
  );
}

/** Single choice among 2–4 short options in one line (e.g. Sistema / Claro / Oscuro). */
export function SegmentedControl<T extends string>({ accessibilityLabel, disabled = false, onChange, options, value }: GroupProps<T>) {
  const { colors } = useOwnlevelTheme();
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={[styles.segmented, { backgroundColor: colors.surfaceRaised }]}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface, borderColor: colors.border }, disabled && styles.disabled]}
          >
            <AppText muted={!selected} style={selected ? styles.selectedText : null} variant="subheadline">{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: radius.chip,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: layout.chipHeight,
    paddingHorizontal: spacing.md,
  },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmented: { borderRadius: radius.inner, flexDirection: 'row', gap: spacing.xs, padding: spacing.xs },
  segment: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: radius.chip,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.minTouch - spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  selectedText: { fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
