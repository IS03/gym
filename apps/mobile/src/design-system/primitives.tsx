import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  type ViewProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, sizes, spacing, typography } from './tokens';
import { useOwnlevelTheme } from './theme';

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

export function ScrollScreen({ children, testID }: Omit<ScreenProps, 'centered'>) {
  const { colors } = useOwnlevelTheme();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID={testID}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Surface({ children, style, ...props }: ViewProps) {
  const { colors } = useOwnlevelTheme();

  return (
    <View
      {...props}
      style={[
        styles.surface,
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
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function Button({ disabled = false, label, onPress, variant = 'primary' }: ButtonProps) {
  const { colors } = useOwnlevelTheme();
  const isPrimary = variant === 'primary';
  const isQuiet = variant === 'quiet';

  return (
    <Pressable
      accessibilityRole="button"
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
  state: {
    borderRadius: radius.md,
  },
  loadingState: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
