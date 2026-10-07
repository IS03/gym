import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { AppIcon, AppText, radius, spacing, useOwnlevelTheme, type AppIconName } from '@/design-system';

/**
 * Home's native-style card (lámina 90): solid surface, card radius, no border; cards are
 * told apart from the background by color only.
 */
export function HomeCard({ children, padded = true, style, ...props }: PropsWithChildren<ViewProps & { padded?: boolean; style?: ViewStyle | ViewStyle[] }>) {
  const { colors } = useOwnlevelTheme();
  return (
    <View {...props} style={[styles.card, padded && styles.padded, { backgroundColor: colors.surface }, style]}>
      {children}
    </View>
  );
}

/** Section title (Title 3 weight) with an optional plain champagne link, inset to the card content. */
export function HomeSectionHeader({ action, onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={styles.header}>
      <AppText accessibilityRole="header" style={styles.headerTitle}>{title}</AppText>
      {action && onAction ? (
        <Pressable accessibilityLabel={action} accessibilityRole="button" hitSlop={10} onPress={onAction}
          style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
          <AppText style={{ color: colors.primary }} variant="subheadline">{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One row of a grouped list: leading icon (30 pt column), title + subtitle, trailing value. */
export function HomeRow({ accessibilityHint, accessibilityLabel, chevron = false, children, icon, onPress, subtitle, testID, title, trailing }: {
  accessibilityHint?: string; accessibilityLabel?: string; chevron?: boolean; children?: React.ReactNode; icon: AppIconName;
  onPress?: () => void; subtitle?: string; testID?: string; title: string; trailing?: React.ReactNode;
}) {
  const { colors } = useOwnlevelTheme();
  const body = (
    <>
      <View style={styles.row}>
        <View style={styles.rowIcon}><AppIcon color={colors.primary} name={icon} size={19} /></View>
        <View style={styles.rowText}>
          <AppText numberOfLines={1} variant="body">{title}</AppText>
          {subtitle ? <AppText muted numberOfLines={2} numeric variant="footnote">{subtitle}</AppText> : null}
        </View>
        {trailing}
        {chevron ? <AppIcon color={colors.textMuted} name="chevronRight" size={14} /> : null}
      </View>
      {children}
    </>
  );
  if (!onPress) {
    return <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={styles.rowWrap} testID={testID}>{body}</View>;
  }
  return (
    <Pressable accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel ?? title} accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.rowWrap, pressed && { backgroundColor: colors.surfaceRaised }]} testID={testID}>
      {body}
    </Pressable>
  );
}

/** Hairline between rows, inset to the text column like iOS grouped lists. */
export function HomeRowSeparator() {
  const { colors } = useOwnlevelTheme();
  return <View style={[styles.separator, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
  header: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 25 },
  padded: { gap: 14, padding: spacing.lg, paddingTop: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44 },
  rowIcon: { alignItems: 'center', width: 30 },
  rowText: { flex: 1, minWidth: 0 },
  rowWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
});
