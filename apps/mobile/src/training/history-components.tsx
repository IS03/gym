import { Pressable, StyleSheet, View } from 'react-native';
import type { TrainingHistorySession } from '@/api/training-history';
import { AppIcon, AppText, Button, InlineUnavailable, ScrollScreen, SkeletonBlock, Surface, UnavailableState, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import { trainingRoutineColor } from './routine-colors';
import { sessionTiming, sessionTotals } from './history-model';
import type { ReadState } from './use-read';

/** One completed session (history list and day). Server truth only. */
export function SessionRow({ session, onPress, divided }: { session: TrainingHistorySession; onPress: () => void; divided?: boolean }) {
  const { colors, isDark } = useOwnlevelTheme();
  const timing = sessionTiming(session);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${session.routineName}. ${timing || 'Sesión terminada'}. ${sessionTotals(session)}`}
    testID={`history-session-${session.id}`} onPress={onPress}
    style={({ pressed }) => [styles.sessionRow, divided ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
      pressed ? { backgroundColor: colors.surfaceRaised } : null]}>
    <View style={[styles.identity, { backgroundColor: session.routineColor ? trainingRoutineColor(session.routineColor, isDark) : colors.border }]} />
    <View style={styles.flex}>
      <AppText numberOfLines={1} variant="label">{session.routineName}</AppText>
      <AppText muted numberOfLines={1} variant="caption">{timing || 'Sesión terminada'}</AppText>
      <AppText muted numberOfLines={1} variant="caption">{sessionTotals(session)}</AppText>
    </View>
    <AppIcon color={colors.textMuted} name="chevronRight" size={14} />
  </Pressable>;
}

export function ListCard({ children }: { children: React.ReactNode }) {
  return <Surface style={styles.listCard}>{children}</Surface>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string;
}) {
  const { colors } = useOwnlevelTheme();
  return <View accessibilityLabel={label} accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
    {options.map(option => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
        style={[styles.segment, selected ? { backgroundColor: colors.surface, borderColor: colors.border } : null]}>
        <AppText style={{ color: selected ? colors.text : colors.textMuted }} variant="label">{option.label}</AppText>
      </Pressable>;
    })}
  </View>;
}

/** Loading / unavailable / not-found screens shared by history reads. Returns null when ready. */
export function ReadStateScreen<T>({ state, onRetry, notFoundTitle = 'No disponible', testID, header }: {
  state: ReadState<T>; onRetry: () => void; notFoundTitle?: string; testID: string; header?: React.ReactNode;
}) {
  if (state.status === 'ready') return null;
  return <ScrollScreen testID={`${testID}-${state.status}`}>
    {header}
    {state.status === 'loading' ? <><SkeletonBlock height={72} /><SkeletonBlock height={88} /><SkeletonBlock height={88} /></>
      : state.status === 'not_found' ? <UnavailableState title={notFoundTitle} description="Puede que se haya eliminado o que no pertenezca a tu cuenta." />
        : <UnavailableState title="No pudimos cargar los datos" description="Tus datos siguen seguros. Revisá la conexión e intentá nuevamente."
          action={<Button label="Reintentar" onPress={onRetry} />} />}
  </ScrollScreen>;
}

export function StaleNotice({ onRetry }: { onRetry: () => void }) {
  return <Surface><InlineUnavailable actionLabel="Reintentar" message="No se pudo actualizar. Mostramos la última lectura confirmada." onAction={onRetry} /></Surface>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  listCard: { padding: 0, gap: 0, overflow: 'hidden' },
  sessionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  identity: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginVertical: spacing.xs },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: sizes.touchTarget - 6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
});
