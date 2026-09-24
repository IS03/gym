import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  type TextProps,
  type ViewProps,
  type ViewStyle,
  View,
} from 'react-native';
import {
  type Edge,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { radius, sizes, spacing, typography } from './tokens';
import { useOwnlevelTheme } from './theme';
import { AppIcon, type AppIconName } from './icons';

type AppTextVariant = keyof typeof typography;

type AppTextProps = TextProps & {
  muted?: boolean;
  variant?: AppTextVariant;
};

export function AppText({ muted = false, style, variant = 'body', ...props }: AppTextProps) {
  const { colors } = useOwnlevelTheme();

  return (
    <Text
      {...props}
      style={[typography[variant], { color: muted ? colors.textMuted : colors.text }, style]}
    />
  );
}

type HeadingProps = Omit<AppTextProps, 'variant'> & {
  level?: 1 | 2;
};

export function Heading({ level = 1, ...props }: HeadingProps) {
  return <AppText accessibilityRole="header" variant={level === 1 ? 'display' : 'heading'} {...props} />;
}

type ScreenProps = PropsWithChildren<{
  centered?: boolean;
  testID?: string;
}>;

export function Screen({ centered = false, children, testID }: ScreenProps) {
  const { colors } = useOwnlevelTheme();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID={testID}
    >
      <View style={[styles.screenContent, centered && styles.centered]}>{children}</View>
    </SafeAreaView>
  );
}

type ScrollScreenProps = PropsWithChildren<
  Omit<ScrollViewProps, 'children'> & {
    safeAreaEdges?: Edge[];
    testID?: string;
  }
>;

export function ScrollScreen({
  children,
  contentContainerStyle,
  safeAreaEdges = ['left', 'right', 'bottom'],
  testID,
  ...scrollViewProps
}: ScrollScreenProps) {
  const { colors } = useOwnlevelTheme();

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID={testID}
    >
      <ScrollView
        {...scrollViewProps}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type SurfaceProps = ViewProps & { elevated?: boolean };

export function Surface({
  children,
  elevated = false,
  style,
  ...props
}: SurfaceProps) {
  const { colors } = useOwnlevelTheme();

  return (
    <View
      {...props}
      style={[
        styles.surface,
        elevated && styles.elevated,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={[styles.row, style]}>
      {children}
    </View>
  );
}

type ButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function Button({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: ButtonProps) {
  const { colors } = useOwnlevelTheme();
  const isPrimary = variant === 'primary';
  const isQuiet = variant === 'quiet';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? colors.primary : isQuiet ? 'transparent' : colors.surfaceRaised,
          borderColor: isQuiet ? 'transparent' : isPrimary ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <AppText style={{ color: isPrimary ? colors.onPrimary : colors.text }} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

export function Separator() {
  const { colors } = useOwnlevelTheme();
  return <View accessibilityElementsHidden style={[styles.separator, { backgroundColor: colors.border }]} />;
}

type ProgressBarProps = {
  accessibilityLabel: string;
  color?: string;
  maximumValue?: number;
  trackColor?: string;
  value: number;
};

export function ProgressBar({
  accessibilityLabel,
  color,
  maximumValue = 100,
  trackColor,
  value,
}: ProgressBarProps) {
  const { colors } = useOwnlevelTheme();
  const safeMaximum = maximumValue > 0 ? maximumValue : 100;
  const safeValue = Math.min(safeMaximum, Math.max(0, value));
  const percentage = (safeValue / safeMaximum) * 100;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: safeMaximum,
        min: 0,
        now: safeValue,
      }}
      accessible
      style={[
        styles.progressTrack,
        { backgroundColor: trackColor ?? colors.surfaceRaised },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: color ?? colors.primary, width: `${percentage}%` },
        ]}
      />
    </View>
  );
}

type IconCircleProps = {
  backgroundColor?: string;
  color?: string;
  icon: AppIconName;
  size?: 'medium' | 'small';
};

export function IconCircle({
  backgroundColor,
  color,
  icon,
  size = 'medium',
}: IconCircleProps) {
  const { colors } = useOwnlevelTheme();
  const compact = size === 'small';
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.iconCircle,
        compact && styles.iconCircleSmall,
        { backgroundColor: backgroundColor ?? colors.brandSubtle },
      ]}
    >
      <AppIcon
        color={color ?? colors.primary}
        name={icon}
        size={compact ? 17 : 20}
      />
    </View>
  );
}

type SectionHeaderProps = {
  actionLabel?: string;
  onAction?: () => void;
  title: string;
};

export function SectionHeader({
  actionLabel,
  onAction,
  title,
}: SectionHeaderProps) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={styles.sectionHeader}>
      <AppText accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onAction}
          style={({ pressed }) => [
            styles.sectionAction,
            { opacity: pressed ? 0.55 : 1 },
          ]}
        >
          <AppText style={{ color: colors.primary }} variant="caption">
            {actionLabel}
          </AppText>
          <AppIcon color={colors.primary} name="chevronRight" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

type PressableSurfaceProps = PropsWithChildren<{
  accessibilityHint?: string;
  accessibilityLabel: string;
  onPress: () => void;
  style?: ViewStyle;
}>;

export function PressableSurface({
  accessibilityHint,
  accessibilityLabel,
  children,
  onPress,
  style,
}: PressableSurfaceProps) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.surface,
        styles.elevated,
        {
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

type InlineUnavailableProps = {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
};

export function InlineUnavailable({
  actionLabel,
  message,
  onAction,
}: InlineUnavailableProps) {
  const { colors } = useOwnlevelTheme();
  return (
    <View accessibilityRole="alert" style={styles.inlineUnavailable}>
      <AppIcon color={colors.unavailable} name="warning" size={18} />
      <AppText muted style={styles.inlineUnavailableText} variant="caption">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
        >
          <AppText style={{ color: colors.primary }} variant="caption">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonBlock({
  height,
  style,
  width = '100%',
}: {
  height: number;
  style?: ViewStyle;
  width?: ViewStyle['width'];
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.skeleton,
        { backgroundColor: colors.surfaceRaised, height, width },
        style,
      ]}
    />
  );
}

type StateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

function StateMessage({ action, description, title }: StateProps) {
  return (
    <Surface accessibilityRole="summary" style={styles.state}>
      <AppText variant="label">{title}</AppText>
      <AppText muted>{description}</AppText>
      {action}
    </Surface>
  );
}

export function LoadingState({ label = 'Cargando' }: { label?: string }) {
  const { colors } = useOwnlevelTheme();

  return (
    <Surface accessibilityLabel={label} accessibilityRole="progressbar" style={styles.loadingState}>
      <ActivityIndicator color={colors.primary} />
      <AppText muted>{label}</AppText>
    </Surface>
  );
}

export function EmptyState(props: StateProps) {
  return <StateMessage {...props} />;
}

export function UnavailableState(props: StateProps) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={{ borderLeftColor: colors.unavailable, borderLeftWidth: 3 }}>
      <StateMessage {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    alignSelf: 'center',
    flex: 1,
    gap: spacing.xl,
    maxWidth: sizes.contentMaxWidth,
    padding: spacing.lg,
    width: '100%',
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: spacing.xl,
    maxWidth: sizes.contentMaxWidth,
    padding: spacing.lg,
    width: '100%',
  },
  centered: {
    justifyContent: 'center',
  },
  surface: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  elevated: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  separator: {
    height: sizes.separator,
    width: '100%',
  },
  progressTrack: {
    borderRadius: radius.pill,
    height: 7,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconCircleSmall: {
    height: 34,
    width: 34,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  sectionAction: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: sizes.touchTarget,
  },
  inlineUnavailable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
  },
  inlineUnavailableText: {
    flex: 1,
  },
  skeleton: {
    borderRadius: radius.sm,
  },
  state: {
    borderRadius: radius.md,
  },
  loadingState: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
