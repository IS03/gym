import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BODY_MEASUREMENT_FIELDS, BODY_MEASUREMENT_LABELS } from '@/api/body';
import { AppText, Button, SheetHeader, Surface, TextField, spacing, useOwnlevelTheme } from '@/design-system';
import type { BodyController, BodyState } from './body-controller';
import { formatCm, formatKg, measurementBadges } from './body-model';
import type { MeasurementEditor, WeightEditor } from './body-storage';

function Field({ label, value, onChange, error, unit, editable, keyboard = 'decimal-pad', placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; unit?: string; editable: boolean;
  keyboard?: 'decimal-pad' | 'numbers-and-punctuation' | 'default'; placeholder?: string; multiline?: boolean;
}) {
  return <TextField label={label} unit={unit} value={value} onChangeText={onChange} error={error} disabled={!editable} keyboardType={keyboard}
    placeholder={placeholder ?? '—'} multiline={multiline} autoCorrect={false} selectTextOnFocus={!multiline} numeric={keyboard !== 'default'} />;
}

/** Shared sheet shell: explicit states, no dismissal while a change is in flight or unresolved. */
function EditorShell({ title, subtitle, state, controller, children, primary, destructive }: {
  title: string; subtitle: string; state: BodyState; controller: BodyController; children: ReactNode;
  primary: { label: string; onPress: () => void; disabled?: boolean }; destructive?: { label: string; confirm: string; onPress: () => void };
}) {
  const { colors } = useOwnlevelTheme();
  const { phase, intent, message, errors } = state;
  const busy = phase === 'pending';
  const close = () => {
    if (busy || intent) return;
    if (!controller.dirty()) { controller.close(); return; }
    Alert.alert('¿Descartar cambios?', 'Todavía no guardaste este registro.', [
      { text: 'Seguir editando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => controller.close() },
    ]);
  };
  const tone = phase === 'uncertain' || phase === 'confirmed' ? colors.text : phase === 'conflict' || phase === 'blocked' ? colors.danger : colors.text;
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} testID="body-editor">
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SheetHeader title={title} subtitle={subtitle} onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {errors.form ? <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">{errors.form}</AppText> : null}
          {message ? <AppText accessibilityLiveRegion="polite" style={{ color: tone }} variant="caption">{message}</AppText> : null}
          {busy ? <View style={styles.row}><ActivityIndicator color={colors.primary} /><AppText muted variant="caption">Guardando…</AppText></View> : null}
          {phase === 'uncertain' ? <Button label="Comprobar" onPress={() => void controller.recover()} />
            : phase === 'confirmed' ? <Button label="Actualizar lectura" onPress={() => void controller.recover()} />
            : phase === 'conflict' ? <Button label="Revisar valores actuales" onPress={() => controller.reviewTruth()} />
            : phase === 'blocked' ? null
            : <Button label={busy ? 'Guardando…' : primary.label} disabled={busy || primary.disabled} onPress={primary.onPress} />}
          {destructive && phase === 'idle' ? <Button label={destructive.label} variant="quiet" onPress={() => Alert.alert(destructive.confirm, undefined, [
            { text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: destructive.onPress },
          ])} /> : null}
          {!intent && !busy ? <Button label="Cerrar" variant="quiet" onPress={close} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

export function WeightEditorSheet({ editor, state, controller }: { editor: WeightEditor; state: BodyState; controller: BodyController }) {
  const editable = state.phase === 'idle' && !state.intent;
  const editing = editor.mode === 'edit';
  return <EditorShell title={editing ? 'Editar peso' : 'Registrar peso'} subtitle={editing ? 'La fecha del registro no cambia.' : 'Hasta hoy. Si la fecha ya tiene peso, se reemplaza.'}
    state={state} controller={controller} primary={{ label: 'Guardar', onPress: () => void controller.saveWeight() }}
    destructive={editing ? { label: 'Eliminar peso', confirm: '¿Eliminar el peso de esta fecha? El resto del día se conserva.', onPress: () => void controller.deleteWeight() } : undefined}>
    <Field label="Fecha" placeholder="DD/MM/AAAA" keyboard="numbers-and-punctuation" value={editor.draft.date} editable={editable && !editing}
      onChange={v => controller.change('date', v)} error={state.errors.date} />
    <Field label="Peso" unit="kg" placeholder="65,8" value={editor.draft.weight} editable={editable} onChange={v => controller.change('weight', v)} error={state.errors.weight} />
    {editing && editor.baseline !== null ? <AppText muted variant="caption">Valor guardado: {formatKg(editor.baseline)}</AppText> : null}
  </EditorShell>;
}

export function MeasurementEditorSheet({ editor, state, controller }: { editor: MeasurementEditor; state: BodyState; controller: BodyController }) {
  const { colors } = useOwnlevelTheme();
  const editable = state.phase === 'idle' && !state.intent;
  const baseline = editor.baseline;
  const suspect = baseline?.qualityStatus === 'suspect';
  const legacy = baseline ? (['armCm', 'thighCm'] as const).filter(f => baseline[f] !== null) : [];
  return <EditorShell title={baseline ? 'Editar medición' : 'Registrar medidas'} subtitle="Completá sólo lo que mediste. Lo vacío queda sin registrar."
    state={state} controller={controller}
    primary={{ label: suspect ? 'Guardar y verificar' : 'Guardar', disabled: !!baseline && !suspect && !controller.dirty(), onPress: () => void controller.saveMeasurement() }}
    destructive={baseline ? { label: 'Eliminar medición', confirm: '¿Eliminar esta medición?', onPress: () => void controller.deleteMeasurement() } : undefined}>
    {baseline ? measurementBadges(baseline).map(badge => <Surface key={badge.text} style={{ borderColor: badge.tone === 'warning' ? colors.text : colors.border }}>
      <AppText style={{ color: badge.tone === 'warning' ? colors.text : colors.textMuted }} variant="caption">{badge.text}</AppText>
    </Surface>) : null}
    {suspect ? <AppText muted variant="caption">Al guardar la corrección, la medición se marca como verificada y vuelve a contar en el análisis.</AppText> : null}
    <Field label="Fecha" placeholder="DD/MM/AAAA" keyboard="numbers-and-punctuation" value={editor.draft.date} editable={editable}
      onChange={v => controller.change('date', v)} error={state.errors.date} />
    <View style={styles.grid}>
      {BODY_MEASUREMENT_FIELDS.map(field => <View key={field} style={styles.cell}>
        <Field label={BODY_MEASUREMENT_LABELS[field]} unit="cm" value={editor.draft[field]} editable={editable} onChange={v => controller.change(field, v)} error={state.errors[field]} />
      </View>)}
    </View>
    {legacy.length ? <AppText muted variant="caption">
      {legacy.map(f => `${BODY_MEASUREMENT_LABELS[f]} (histórico): ${formatCm(baseline![f])}`).join(' · ')} · se conserva al guardar.
    </AppText> : null}
    <Field label="Condición" keyboard="default" placeholder="Ej.: en ayunas" value={editor.draft.condition} editable={editable} onChange={v => controller.change('condition', v)} error={state.errors.condition} />
    <Field label="Notas" keyboard="default" placeholder="Opcional" multiline value={editor.draft.notes} editable={editable} onChange={v => controller.change('notes', v)} error={state.errors.notes} />
  </EditorShell>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { width: '50%', paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
});
