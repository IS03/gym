import { useSyncExternalStore } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import type { ActiveSessionController } from './active-session-controller';
import { SUMMARY_SCALES, type SessionSummaryDraft } from './active-session-model';
import { SheetHeader } from './active-session-sheets';
import { SummarySlider } from './summary-slider';

type ScaleKey = 'energyLevel' | 'performanceLevel';
const SCALE_LABELS: Record<ScaleKey, string> = { energyLevel: 'Energía', performanceLevel: 'Rendimiento' };

/** Tapping the selected value clears it: unanswered stays null, never 0. */
export function SummaryScale({ field, value, disabled, onChange }: {
  field: ScaleKey; value: number | null; disabled: boolean; onChange: (next: number | null) => void;
}) {
  const { colors } = useOwnlevelTheme();
  const [minimum, maximum] = SUMMARY_SCALES[field];
  const label = SCALE_LABELS[field];
  const options = Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
  return <View style={styles.scale} accessibilityRole="radiogroup" accessibilityLabel={`${label}, de ${minimum} a ${maximum}`}>
    <View style={styles.scaleHeader}>
      <AppText variant="label">{label}</AppText>
      <AppText muted variant="caption">{value === null ? 'Sin responder' : `${value}/${maximum}`}</AppText>
    </View>
    <View style={styles.options}>
      {options.map(option => {
        const selected = value === option;
        return <Pressable key={option} testID={`summary-${field}-${option}`} accessibilityRole="radio" disabled={disabled}
          accessibilityLabel={`${label} ${option} de ${maximum}`} accessibilityState={{ selected, disabled }}
          onPress={() => onChange(selected ? null : option)}
          style={[styles.option, {
            borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, opacity: disabled ? 0.5 : 1,
          }]}>
          <AppText style={{ color: selected ? colors.onPrimary : colors.text }} variant="label">{option}</AppText>
        </Pressable>;
      })}
    </View>
  </View>;
}

export function FinishSessionSheet({ controller, onClose }: { controller: ActiveSessionController; onClose: () => void }) {
  const { colors } = useOwnlevelTheme();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const progress = useSyncExternalStore(controller.subscribeProgress, controller.getProgress, controller.getProgress);
  const finishIntent = state.intent?.value.kind === 'finish' ? state.intent : null;
  // While a finish is pending, show the frozen metadata that will be replayed.
  const pendingMetadata = state.intent?.value.kind === 'finish' ? state.intent.value.metadata : null;
  const running = state.finishing || finishIntent?.phase === 'running';
  const blockedByOther = Boolean(state.intent && !finishIntent);
  const editable = state.summaryReady && !running && !state.intent && !state.fenced;
  const change = (update: Partial<SessionSummaryDraft>) => controller.updateSummary(summary => ({ ...summary, ...update }));
  const close = () => { if (!running) onClose(); };
  const status = finishIntent?.phase === 'uncertain'
    ? 'No pudimos confirmar si el entrenamiento se guardó. Comprobalo antes de seguir: no se va a guardar dos veces.'
    : finishIntent?.phase === 'blocked' ? state.notice ?? 'La finalización necesita revisión.' : !running ? state.notice : null;
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    {/* RN Modal content renders outside the app's gesture root. */}
    <GestureHandlerRootView style={styles.screen}><SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} testID="finish-session-sheet">
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SheetHeader title="Finalizar entrenamiento" subtitle={`${progress.completedSets}/${progress.totalSets} series completadas`} onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText muted variant="caption">Resumen opcional. Lo que no completes queda sin responder.</AppText>
          {(['energyLevel', 'performanceLevel'] as const).map(field => <SummaryScale key={field} field={field}
            value={pendingMetadata ? pendingMetadata[field] : state.summary[field]} disabled={!editable} onChange={value => change({ [field]: value })} />)}
          <SummarySlider field="painLevel" label="Dolor" minimumLabel="sin dolor" minimum={SUMMARY_SCALES.painLevel[0]} maximum={SUMMARY_SCALES.painLevel[1]}
            value={pendingMetadata ? pendingMetadata.painLevel : state.summary.painLevel} disabled={!editable} onChange={painLevel => change({ painLevel })} />
          <View style={styles.scale}>
            <AppText variant="label">Notas</AppText>
            <TextInput accessibilityLabel="Notas del entrenamiento" editable={editable} multiline placeholder="¿Cómo te sentiste? Algo para recordar la próxima vez…"
              placeholderTextColor={colors.textMuted} value={pendingMetadata ? pendingMetadata.notes ?? '' : state.summary.notes}
              onChangeText={notes => change({ notes })} style={[styles.notes, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]} />
          </View>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {status ? <AppText accessibilityLiveRegion="polite" style={{ color: finishIntent?.phase === 'uncertain' ? colors.warning : colors.danger }} variant="caption">{status}</AppText> : null}
          {progress.completedSets === 0 && !finishIntent ? <AppText muted variant="caption">Marcá al menos una serie para finalizar.</AppText> : null}
          {running ? <View style={styles.pending}><ActivityIndicator color={colors.primary} />
            <AppText muted variant="caption">{state.finishing ? 'Guardando los cambios pendientes…' : 'Guardando el entrenamiento…'}</AppText></View> : null}
          {finishIntent && finishIntent.phase !== 'running'
            ? <Button label="Comprobar entrenamiento" onPress={() => void controller.retryIntent()} />
            : <Button label={running ? 'Guardando…' : 'Guardar entrenamiento'} disabled={running || blockedByOther || state.fenced || progress.completedSets === 0 || !state.summaryReady}
              onPress={() => void controller.finish()} />}
          <Button label="Seguir entrenando" variant="quiet" disabled={running} onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView></GestureHandlerRootView>
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  scale: { gap: spacing.sm },
  scaleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  options: { flexDirection: 'row', gap: spacing.xs },
  option: { flex: 1, minHeight: sizes.touchTarget, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  notes: { minHeight: 96, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: 16, textAlignVertical: 'top' },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  pending: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
