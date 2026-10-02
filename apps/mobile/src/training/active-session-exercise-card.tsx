import { memo, type ReactNode, useCallback, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { AppIcon, AppText, Button, Separator, Surface, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import { haptics } from '@/platform/haptics';
import type { ActiveSessionController, ExercisePhase } from './active-session-controller';
import { appendSessionSet, compactActual, nextReminder, removeSessionSet, resetSessionSet, setProgress, type SessionExerciseDraft } from './active-session-model';
import { formatRest, muscleGroupLabel } from './exercise-library-model';
import { SessionNoteSheet } from './active-session-sheets';
import { NativeDragHandle, NativeReorderItem, NativeReorderList, NativeSwipeActions } from './session-native-interactions';

const statusLabels: Partial<Record<ExercisePhase, string>> = {
  validation: 'Revisá los valores', conflict: 'Cambio en otro dispositivo', retryable: 'No se pudo guardar', unconfirmed: 'Pendiente de conexión · Guardado sin confirmar',
   stale: 'Cambios pendientes de revisar', closed: 'Solo lectura', removed: 'Ejercicio quitado',
};
// Header and data rows share these exact five cells. Do not put flex styles on
// Text in the header and View in rows: Text measurement can change the columns.
function SeriesColumns({ ordinal, kg, reps, rir, completed, header = false }: {
  ordinal: ReactNode; kg: ReactNode; reps: ReactNode; rir: ReactNode; completed: ReactNode; header?: boolean;
}) {
  return <View style={styles.columns} accessibilityElementsHidden={header} testID={header ? 'series-column-header' : 'series-column-row'}>
    <View style={styles.ordinalColumn}>{ordinal}</View>
    <View style={styles.numericColumn}>{kg}</View>
    <View style={styles.numericColumn}>{reps}</View>
    <View style={styles.rirColumn}>{rir}</View>
    <View style={styles.completedColumn}>{completed}</View>
  </View>;
}
export const ActiveExerciseCard = memo(function ActiveExerciseCard({ controller, id, expanded, locked, onToggle, onHistory, onRemove }: {
  controller: ActiveSessionController; id: string; expanded: boolean; locked: boolean;
  onToggle: (id: string) => void; onHistory: (id: string) => void; onRemove: (id: string, name: string) => void;
}) {
  const subscribe = useCallback((listener: () => void) => controller.subscribeExercise(id, listener), [controller, id]);
  const get = useCallback(() => controller.getExercise(id), [controller, id]);
  const state = useSyncExternalStore(subscribe, get, get);
  const { colors } = useOwnlevelTheme();
  const [noteOpen, setNoteOpen] = useState(false);
  const timer = useSyncExternalStore(controller.subscribeTimer, controller.getTimer, controller.getTimer);
  const tapHeader = useCallback(() => { Keyboard.dismiss(); haptics.selection(); onToggle(id); }, [id, onToggle]);
  if (!state) return null;
  const { exercise, draft } = state;
  const editable = !locked && controller.canEdit(id);
  const contextual = !locked && state.storageReady && state.phase !== 'closed' && state.phase !== 'removed';
  const canDiscard = state.dirty || state.stale;
  const completion = setProgress(draft);
  const reminder = nextReminder(exercise);
  const identity = [exercise.muscleGroupLabelSnapshot || muscleGroupLabel(exercise.muscleGroupSnapshot), exercise.implementSnapshot, exercise.weightModeSnapshot].filter(Boolean).join(' · ');
  const discardChanges = () => {
    if (!contextual || !canDiscard) return;
    Alert.alert('¿Descartar cambios?', 'Se descartarán los cambios de este ejercicio que todavía no están guardados.', [
         { text: 'Seguir editando', style: 'cancel' }, { text: 'Descartar cambios', style: 'destructive', onPress: () => void controller.useSaved(id) },
      ]);
  };
  const moveExercise = (direction: number) => {
    const ids = controller.getSnapshot().detail?.exercises.map(row => row.id) ?? [], index = ids.indexOf(id), to = index + direction;
    if (to < 0 || to >= ids.length || !controller.beginExerciseDrag()) return;
    ids.splice(index, 1); ids.splice(to, 0, id);
    void controller.dropExercises(ids).then(confirmed => { if (confirmed) haptics.selection(); });
  };
  return <Surface style={styles.card} testID={`session-exercise-${id}`}>
    <NativeSwipeActions label={exercise.nameSnapshot} disabled={!contextual} actions={[
      { label: draft.notes.trim() ? 'Editar nota' : 'Agregar nota', disabled: !editable, onPress: () => { Keyboard.dismiss(); setNoteOpen(true); } },
       ...(canDiscard ? [{ label: 'Descartar cambios', onPress: discardChanges }] : []),
      { label: 'Quitar', destructive: true, disabled: !editable, onPress: () => onRemove(id, exercise.nameSnapshot) },
    ]}>
    <NativeDragHandle testID={`exercise-header-${id}`} disabled={locked} accessibilityRole="button" accessibilityLabel={`${expanded ? 'Contraer' : 'Expandir'} ${exercise.nameSnapshot}`} accessibilityState={{ expanded }}
      accessibilityHint="Mantené presionado para mover. Deslizá a la izquierda para más acciones."
      accessibilityActions={contextual ? [{ name: 'moveUp', label: 'Mover arriba' }, { name: 'moveDown', label: 'Mover abajo' },
         { name: 'note', label: draft.notes.trim() ? 'Editar nota' : 'Agregar nota' }, ...(canDiscard ? [{ name: 'discard', label: 'Descartar cambios' }] : []), { name: 'remove', label: 'Quitar de la sesión' }] : undefined}
      onAccessibilityAction={event => {
        const action = event.nativeEvent.actionName;
        if (action === 'moveUp') moveExercise(-1); else if (action === 'moveDown') moveExercise(1);
         else if (action === 'note' && editable) setNoteOpen(true); else if (action === 'discard') discardChanges(); else if (action === 'remove' && editable) onRemove(id, exercise.nameSnapshot);
      }}
      onTap={tapHeader} style={styles.header}>
      <View style={[styles.icon, { backgroundColor: colors.brandSubtle }]}><AppIcon name="dumbbell" color={colors.primary} size={19} /></View>
      <View style={styles.flex}>
        <AppText numberOfLines={2} variant="label">{exercise.nameSnapshot}</AppText>
        <AppText muted numberOfLines={2} variant="caption">{identity}</AppText>
        {reminder ? <AppText numberOfLines={2} style={{ color: colors.primary }} variant="caption">Próxima sesión · {reminder}</AppText> : null}
        {draft.notes.trim() ? <View style={styles.noteIndicator} accessibilityLabel="Este ejercicio tiene una nota">
          <AppIcon name="note" color={colors.textMuted} size={13} /><AppText muted variant="caption">Nota</AppText></View> : null}
      </View>
      <View style={[styles.badge, { backgroundColor: completion.complete ? colors.brandSubtle : colors.surfaceRaised }]}><AppText style={{ color: completion.complete ? colors.success : colors.textMuted }} variant="caption">{completion.completed}/{completion.total}</AppText></View>
      {state.phase === 'saving' ? <ActivityIndicator testID={`exercise-saving-${id}`} accessibilityLabel="Sincronizando ejercicio" size="small" color={colors.textMuted} /> : null}
      <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}><AppIcon name="chevronRight" color={colors.textMuted} size={15} /></View>
    </NativeDragHandle></NativeSwipeActions>
    {state.error || statusLabels[state.phase] ? <View style={styles.recovery}>
      <AppText accessibilityLiveRegion="polite" style={{ color: colors.danger }} variant="caption">{statusLabels[state.phase] ?? state.error}</AppText>
      {state.error && statusLabels[state.phase] ? <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">{state.error}</AppText> : null}
      {['conflict', 'stale', 'retryable', 'unconfirmed'].includes(state.phase) ? <>
        <Button disabled={locked} label="Comprobar cambios" onPress={() => void controller.checkExercise(id)} variant="secondary" />
         {canDiscard ? <Button disabled={locked} label="Descartar cambios" onPress={discardChanges} variant="quiet" /> : null}
      </> : state.error && (!state.storageReady || state.phase === 'scheduled') ? <Button label="Reintentar lectura" onPress={() => void controller.refresh()} variant="secondary" /> : null}
    </View> : null}
    {expanded ? <View style={styles.body}>
      <Separator />
      <View style={styles.row}><AppText style={styles.flex} variant="label">Series</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Historial de ${exercise.nameSnapshot}`} disabled={locked}
          onPress={() => { Keyboard.dismiss(); onHistory(id); }} style={[styles.historyTrigger, { backgroundColor: colors.brandSubtle, opacity: locked ? 0.45 : 1 }]}>
          <AppIcon name="clock" color={colors.primary} size={16} /><AppText style={{ color: colors.primary }} variant="caption">Historial</AppText>
        </Pressable></View>
      <SeriesColumns header ordinal={<AppText muted style={styles.columnTitle} variant="overline">#</AppText>}
        kg={<AppText muted style={styles.columnTitle} variant="overline">KG</AppText>} reps={<AppText muted style={styles.columnTitle} variant="overline">REPS</AppText>}
        rir={<AppText muted style={styles.columnTitle} variant="overline">RIR</AppText>} completed={<AppText muted style={styles.columnTitle} variant="overline">✓</AppText>} />
      <NativeReorderList ids={draft.sets.map(set => set.localId)} onLift={() => { const accepted = controller.beginSetDrag(id); if (accepted) Keyboard.dismiss(); return accepted; }}
        onDrop={ids => controller.dropSets(id, ids)} onCancel={() => controller.cancelDrag()}>
        {draft.sets.map((set, index) => <NativeReorderItem key={set.localId} id={set.localId}>
          <ActiveSetRow controller={controller} id={id} name={exercise.nameSnapshot} set={set} index={index} count={draft.sets.length} editable={editable} />
        </NativeReorderItem>)}
      </NativeReorderList>
       {state.phase !== 'closed' && state.phase !== 'removed' ? <Button disabled={!editable || draft.sets.length >= 50} label="+ Agregar serie" onPress={() => controller.change(id, appendSessionSet, true)} variant="secondary" /> : null}
      {exercise.restMinSecondsSnapshot !== null || exercise.restMaxSecondsSnapshot !== null ? <View style={[styles.restRow, { backgroundColor: colors.surfaceRaised }]}>
        <AppIcon name="clock" color={colors.primary} size={18} /><View style={styles.flex}><AppText variant="caption">Descanso</AppText>
          <AppText variant="label">{[exercise.restMinSecondsSnapshot, exercise.restMaxSecondsSnapshot].filter((value, i, array) => value !== null && (i === 0 || value !== array[0])).map(formatRest).join(' – ')}</AppText></View>
        <Button disabled={!editable} label={timer?.exerciseId === id ? 'Saltar descanso' : 'Iniciar descanso'} onPress={() => timer?.exerciseId === id ? controller.skipRest() : controller.startRest(id)} variant="quiet" />
      </View> : null}
      <Separator /><AppText variant="label">Próxima vez</AppText>
      <View style={styles.row}>
        {([['increase_weight', '+ Peso'], ['increase_reps', '+ Repeticiones']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button"
          accessibilityState={{ selected: draft.decision === value, disabled: !editable }} disabled={!editable}
          onPress={() => { haptics.selection(); controller.change(id, current => ({ ...current, decision: current.decision === value ? 'maintain' : value, decisionNote: '' }), true); }}
          style={[styles.decision, { borderColor: draft.decision === value ? colors.primary : colors.border, backgroundColor: draft.decision === value ? colors.brandSubtle : colors.surface }]}>
          <AppText variant="caption">{label}</AppText></Pressable>)}
      </View>
      {draft.decision === 'custom' ? <View><AppText muted variant="caption">Recordatorio anterior</AppText><AppText>{draft.decisionNote}</AppText>
        <Button disabled={!editable} label="Quitar recordatorio" onPress={() => controller.change(id, current => ({ ...current, decision: 'maintain', decisionNote: '' }), true)} variant="quiet" /></View> : null}
      {exercise.routineExerciseId ? <View style={styles.row}>
        <View style={styles.flex}><AppText variant="label">Tomar resultado de hoy</AppText><AppText muted variant="caption">Usa las series completadas como base.</AppText></View>
        <Switch accessibilityLabel="Tomar resultado de hoy" disabled={!editable} value={draft.applyToRoutine} trackColor={{ true: colors.primary, false: colors.border }}
          onValueChange={value => { haptics.selection(); controller.change(id, current => ({ ...current, applyToRoutine: value }), true); }} />
      </View> : null}
    </View> : null}
     {noteOpen ? <SessionNoteSheet name={exercise.nameSnapshot} value={draft.notes} editable={editable}
       onSave={async notes => {
         if (!controller.canEdit(id)) return false;
         controller.change(id, current => ({ ...current, notes }), true); await controller.flush(id);
         const latest = controller.getExercise(id);
         return latest?.phase === 'saved' && !latest.dirty && latest.draft.notes === notes;
       }}
       onClose={() => { Keyboard.dismiss(); setNoteOpen(false); }} /> : null}
  </Surface>;
});
function ActiveSetRow({ controller, id, name, set, index, count, editable }: {
  controller: ActiveSessionController; id: string; name: string; set: SessionExerciseDraft['sets'][number]; index: number; count: number; editable: boolean;
}) {
  const { colors } = useOwnlevelTheme();
  const tapCompleted = useCallback(() => {
    haptics.selection();
    controller.change(id, current => ({ ...current, sets: current.sets.map(row => row.localId === set.localId ? { ...row, isCompleted: !row.isCompleted } : row) }), true);
  }, [controller, id, set.localId]);
  const mutate = (operation: (draft: SessionExerciseDraft, position: number) => SessionExerciseDraft) => controller.change(id, current => operation(current, current.sets.findIndex(row => row.localId === set.localId)), true);
  const reset = () => mutate(resetSessionSet);
  const remove = () => {
    if (count <= 1) return;
    Alert.alert(`¿Eliminar serie ${index + 1}?`, 'Se quitará sólo de este ejercicio en la sesión actual.', [
      { text: 'Conservar serie', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => mutate(removeSessionSet) },
    ]);
  };
  const move = (direction: number) => {
    const ids = controller.getExercise(id)?.draft.sets.map(row => row.localId) ?? [], from = ids.indexOf(set.localId), to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length || !controller.beginSetDrag(id)) return;
    ids.splice(from, 1); ids.splice(to, 0, set.localId); void controller.dropSets(id, ids).then(confirmed => { if (confirmed) haptics.selection(); });
  };
  const actions = [{ name: 'moveUp', label: 'Mover arriba' }, { name: 'moveDown', label: 'Mover abajo' }, { name: 'reset', label: 'Resetear serie' },
    ...(count > 1 ? [{ name: 'delete', label: 'Eliminar serie' }] : [])];
  const accessibilityAction: View['props']['onAccessibilityAction'] = event => {
    const action = event.nativeEvent.actionName;
    if (action === 'moveUp') move(-1); else if (action === 'moveDown') move(1); else if (action === 'reset') reset(); else if (action === 'delete') remove();
  };
  const updateActual = (key: 'actualReps' | 'actualWeightKg', value: string) => controller.change(id, current => ({ ...current,
    sets: current.sets.map(row => row.localId === set.localId ? { ...row, [key]: value } : row) }));
  return <NativeSwipeActions label={`Serie ${index + 1}`} disabled={!editable} actions={[{ label: 'Resetear', onPress: reset }, { label: 'Eliminar', destructive: true, disabled: count <= 1, onPress: remove }]}>
    <View style={[styles.setBlock, { borderBottomColor: colors.border }]}>
      <SeriesColumns ordinal={<NativeDragHandle testID={`set-handle-${set.localId}`} disabled={!editable} accessibilityRole="button" accessibilityLabel={`Mover serie ${index + 1}`}
        accessibilityHint="Mantené presionado para arrastrar. Deslizá a la izquierda para resetear o eliminar." accessibilityActions={actions} onAccessibilityAction={accessibilityAction} style={styles.controlTrack}>
        <AppText muted variant="caption">{index + 1}</AppText></NativeDragHandle>}
        kg={<><TextInput accessibilityLabel={`Peso serie ${index + 1} de ${name}`} editable={editable} keyboardType="decimal-pad" selectTextOnFocus
          placeholder="—" placeholderTextColor={colors.textMuted} value={set.actualWeightKg} onChangeText={value => updateActual('actualWeightKg', value)}
          onEndEditing={() => void controller.flush(id)} style={[styles.numberInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} />
          <AppText muted style={styles.target} variant="caption">obj {compactActual(set.targetWeightKg)}</AppText></>}
        reps={<><TextInput accessibilityLabel={`Reps serie ${index + 1} de ${name}`} editable={editable} keyboardType="number-pad" selectTextOnFocus
          placeholder="—" placeholderTextColor={colors.textMuted} value={set.actualReps} onChangeText={value => updateActual('actualReps', value)}
          onEndEditing={() => void controller.flush(id)} style={[styles.numberInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]} />
          <AppText muted style={styles.target} variant="caption">obj {compactActual(set.targetReps)}</AppText></>}
        rir={<NativeDragHandle testID={`set-rir-${set.localId}`} disabled={!editable} accessibilityRole="button" accessibilityLabel={`RIR objetivo serie ${index + 1}: ${compactActual(set.targetRir)}`}
          accessibilityActions={actions} onAccessibilityAction={accessibilityAction} style={styles.controlTrack}><AppText variant="label">{compactActual(set.targetRir)}</AppText></NativeDragHandle>}
        completed={<NativeDragHandle testID={`set-check-${set.localId}`} accessibilityRole="checkbox" accessibilityLabel={`Serie ${index + 1} completada`} accessibilityState={{ checked: set.isCompleted, disabled: !editable }} disabled={!editable}
          accessibilityActions={actions} onAccessibilityAction={accessibilityAction}
          onTap={tapCompleted} style={styles.controlTrack}>
          {set.isCompleted ? <AppIcon name="check" color={colors.success} size={29} /> : <View style={[styles.unchecked, { borderColor: colors.border }]} />}</NativeDragHandle>} />
    </View>
  </NativeSwipeActions>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm }, flex: { flex: 1 }, header: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 64 },
  icon: { height: 36, width: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  noteIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, body: { gap: spacing.md }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }, ordinalColumn: { width: sizes.touchTarget }, numericColumn: { flex: 1, minWidth: 0 },
  rirColumn: { width: sizes.touchTarget }, completedColumn: { width: sizes.touchTarget }, columnTitle: { textAlign: 'center' },
  controlTrack: { minHeight: sizes.touchTarget, width: sizes.touchTarget, justifyContent: 'center', alignItems: 'center' },
  unchecked: { borderWidth: 1.5, borderRadius: radius.pill, height: 26, width: 26 },
  numberInput: { borderWidth: 1, borderRadius: radius.sm, minHeight: sizes.touchTarget, fontSize: 17, fontWeight: '600', textAlign: 'center', paddingHorizontal: spacing.xs, fontVariant: ['tabular-nums'] },
  target: { textAlign: 'center', fontSize: 11, paddingTop: spacing.xs }, setBlock: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.sm },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md }, recovery: { gap: spacing.sm },
  decision: { flex: 1, borderWidth: 1, borderRadius: radius.md, minHeight: sizes.touchTarget, justifyContent: 'center', alignItems: 'center' },
  historyTrigger: { minHeight: sizes.touchTarget, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
