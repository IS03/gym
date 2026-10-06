import { Children, Fragment, isValidElement, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout } from './brand';
import { AppIcon, appIconSize, type AppIconName } from './icons';
import { AppText, Separator } from './primitives';
import { radius, spacing } from './tokens';
import { useOwnlevelTheme } from './theme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: AppIconName;
  /** Trailing value text (muted, tabular when numeric). */
  value?: string;
  numericValue?: boolean;
  /** Trailing control (switch, badge) instead of a value. */
  trailing?: ReactNode;
  /** Defaults to true for pressable rows. */
  chevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/** Row: icon + title + subtitle + trailing value/control/chevron. Min touch 44. */
export function ListRow({
  accessibilityHint, accessibilityLabel, chevron, disabled = false, icon, numericValue = false, onPress, subtitle,
  testID, title, trailing, value,
}: ListRowProps) {
  const { colors } = useOwnlevelTheme();
  const content = (
    <>
      {icon ? <AppIcon color={colors.textMuted} name={icon} size={appIconSize.row} /> : null}
      <View style={styles.text}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? <AppText muted variant="footnote">{subtitle}</AppText> : null}
      </View>
      {value ? <AppText muted numeric={numericValue} variant="subheadline">{value}</AppText> : null}
      {trailing}
      {(chevron ?? Boolean(onPress)) ? <AppIcon color={colors.textMuted} name="chevronRight" size={appIconSize.inline} /> : null}
    </>
  );
  if (!onPress) {
    return <View accessible={Boolean(accessibilityLabel)} accessibilityLabel={accessibilityLabel} style={styles.row} testID={testID}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

/** Grouped list on a card with hairline separators between rows (no glass). */
export function ListGroup({ children }: PropsWithChildren) {
  const { colors } = useOwnlevelTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 ? <Separator /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: radius.inner,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: layout.rowHeight,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: 2 },
  group: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.xs,
  },
  disabled: { opacity: 0.45 },
});
