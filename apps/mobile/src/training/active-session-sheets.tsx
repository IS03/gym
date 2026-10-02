import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMobileTrainingExercises, useApiResource } from '@/api';
import type { MobileApiClient } from '@/api/client';
import type { SessionDetailDto, SessionExerciseDto } from '@/api/active-session';
import type { MobileTrainingExercise, MobileTrainingMuscleGroup } from '@/api/exercises';
import { AppIcon, AppText, Button, EmptyState, Heading, InlineUnavailable, SkeletonBlock, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import { MUSCLE_GROUP_OPTIONS, exerciseSummary } from './exercise-library-model';
import { pickerExercises } from './routine-editor-model';
import { compactActual, compactHistoryDate, historyLoadLabel, quickSessions } from './active-session-model';
export { SessionNoteSheet } from './session-note-sheet';

function SheetHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return <View style={styles.header}>
    <View style={styles.flex}><Heading level={2}>{title}</Heading><AppText muted variant="caption">{subtitle}</AppText></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Cerrar ${title}`} onPress={onClose} style={styles.close}><AppText style={styles.closeText}>×</AppText></Pressable>
  </View>;
}
function PickerBody({ client, existingIds, onClose, onCreate, onAdd }: {
  client: MobileApiClient; existingIds: ReadonlySet<string>; onClose: () => void; onCreate: () => void; onAdd: (exercise: MobileTrainingExercise) => void;
}) {
  const { colors } = useOwnlevelTheme();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<MobileTrainingMuscleGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => fetchMobileTrainingExercises(client, signal), [client]);
  const { state, refresh } = useApiResource(load);
  const catalog = state.status === 'ready' ? state.current.data.catalog : undefined;
  const available = useMemo(() => catalog?.status === 'ok' ? pickerExercises(catalog.data.exercises, existingIds, search, group) : [], [catalog, existingIds, group, search]);
  const selected = catalog?.status === 'ok' ? catalog.data.exercises.find(exercise => exercise.id === selectedId && exercise.isActive && !existingIds.has(exercise.id)) : null;
  return <>
    <SheetHeader title="Agregar ejercicio" subtitle="Elegí uno de tu biblioteca o creá uno nuevo." onClose={onClose} />
    <View style={styles.controls}>
      <TextInput accessibilityLabel="Buscar ejercicio" placeholder="Buscar ejercicio" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[{ value: null, label: 'Todos' }, ...MUSCLE_GROUP_OPTIONS].map(option => <Pressable key={option.value ?? 'all'} accessibilityRole="button"
          accessibilityState={{ selected: group === option.value }} onPress={() => setGroup(option.value)}
          style={[styles.chip, { backgroundColor: group === option.value ? colors.brandSubtle : colors.surface, borderColor: group === option.value ? colors.primary : colors.border }]}>
          <AppText variant="caption">{option.label}</AppText></Pressable>)}
      </ScrollView>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {state.status === 'loading' ? <SkeletonBlock height={180} /> : catalog?.status !== 'ok' ?
        <InlineUnavailable message="No pudimos cargar la biblioteca." actionLabel="Reintentar" onAction={() => void refresh()} /> : available.length === 0 ?
          <EmptyState title="No hay ejercicios disponibles" description="Probá con otro filtro o creá un ejercicio nuevo." /> : available.map(exercise =>
            <Pressable key={exercise.id} accessibilityRole="radio" accessibilityState={{ checked: selectedId === exercise.id }} onPress={() => setSelectedId(exercise.id)}
              style={[styles.option, { backgroundColor: colors.surface, borderColor: selectedId === exercise.id ? colors.primary : colors.border }]}>
              <View style={styles.flex}><AppText variant="label">{exercise.name}</AppText><AppText muted variant="caption">{exerciseSummary(exercise)}</AppText></View>
              {selectedId === exercise.id ? <AppIcon name="check" color={colors.primary} size={22} /> : null}
            </Pressable>)}
    </ScrollView>
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      {selected ? <AppText muted numberOfLines={1} variant="caption">Seleccionado: {selected.name}</AppText> : null}
      <Button disabled={!selected} label="Agregar a la sesión" onPress={() => { if (selected) onAdd(selected); }} />
      <Button label="Crear ejercicio nuevo" onPress={onCreate} variant="quiet" />
    </View>
  </>;
}
export function SessionExercisePicker({ visible, client, existingIds, onClose, onDismiss, onCreate, onAdd }: {
  visible: boolean; client: MobileApiClient; existingIds: ReadonlySet<string>;
  onClose: () => void; onDismiss: () => void; onCreate: () => void; onAdd: (exercise: MobileTrainingExercise) => void;
}) {
  const { colors } = useOwnlevelTheme();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={onDismiss}>
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {visible ? <PickerBody client={client} existingIds={existingIds} onClose={onClose} onCreate={onCreate} onAdd={onAdd} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
export function SessionQuickHistory({ exercise, history, onClose, onRefresh }: {
  exercise: SessionExerciseDto; history: SessionDetailDto['quickHistory']; onClose: () => void; onRefresh: () => void;
}) {
  const { colors } = useOwnlevelTheme();
  const sessions = history.status === 'ok' ? quickSessions(history.data[exercise.exerciseId] ?? []) : [];
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <SheetHeader title="Historial" subtitle={exercise.nameSnapshot} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.historyContent}>
        {sessions.length ? <AppText muted variant="caption">Series completadas · RIR objetivo</AppText> : null}
        {history.status === 'unavailable' ? <InlineUnavailable message="No pudimos consultar las últimas sesiones. Podés seguir entrenando." actionLabel="Reintentar" onAction={onRefresh} /> :
          sessions.length === 0 ? <EmptyState title="Todavía sin registros" description="No hay sesiones finalizadas con este ejercicio." /> : sessions.map((session, index) => {
            const completed = session.sets.filter(set => set.isCompleted);
            return <View key={session.sessionId} testID={`quick-history-session-${session.sessionId}`}
              style={[styles.historySession, { borderColor: colors.border, backgroundColor: index === 0 ? colors.brandSubtle : colors.surface }]}>
              {index === 0 ? <AppText style={{ color: colors.primary }} variant="caption">Última sesión</AppText> : null}
              <AppText variant="label">{compactHistoryDate(session.logDate)} · {session.routineName}</AppText>
              {completed.length ? completed.map(set => <View key={set.setNumber} style={styles.historySet}>
                <AppText muted style={styles.historyNumber} variant="caption">{set.setNumber}</AppText>
                <AppText style={styles.historyLoad} variant="caption">{historyLoadLabel(set)}</AppText>
                <AppText accessibilityLabel={`RIR objetivo serie ${set.setNumber}: ${compactActual(set.targetRir)}`} style={styles.historyRir} muted variant="caption">RIR {compactActual(set.targetRir)}</AppText>
              </View>) : <AppText muted variant="caption">No hay series completadas.</AppText>}
            </View>;
          })}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  close: { minWidth: sizes.touchTarget, minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28 },
  controls: { paddingHorizontal: spacing.lg, gap: spacing.sm }, chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: sizes.touchTarget, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: sizes.touchTarget, fontSize: 16 },
  content: { padding: spacing.lg, gap: spacing.md },
  option: { borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center', minHeight: 64 },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1 },
  historyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  historySession: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  historySet: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingVertical: 2 }, historyNumber: { width: 20 }, historyLoad: { flex: 1 }, historyRir: { minWidth: 48, textAlign: 'right' },
});
