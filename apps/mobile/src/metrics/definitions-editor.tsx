import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { METRIC_DEFINITION_VALUE_TYPES } from '@/api/metric-definitions';
import { AppText, Button, SheetHeader, TextField, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import type { DefinitionsController, DefinitionsState } from './definitions-controller';
import { VALUE_TYPE_LABELS } from './definitions-model';
import type { DefinitionEditor } from './definitions-storage';

function Field({ label, value, onChange, error, editable, keyboard = 'default', placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; editable: boolean;
  keyboard?: 'default' | 'decimal-pad' | 'number-pad'; placeholder?: string; hint?: string;
}) {
  return <TextField label={label} value={value} onChangeText={onChange} error={error} hint={hint} disabled={!editable} keyboardType={keyboard}
    placeholder={placeholder ?? '—'} autoCorrect={false} numeric={keyboard !== 'default'} />;
}

/** Create / edit one definition. Only what the domain allows is editable; the rest is shown read-only. */
export function DefinitionEditorSheet({ editor, state, controller }: { editor: DefinitionEditor; state: DefinitionsState; controller: DefinitionsController }) {
  const { colors } = useOwnlevelTheme();
  const { phase, intent, message, errors } = state;
  const busy = phase === 'pending';
  const editable = phase === 'idle' && !intent;
  const b = editor.baseline, d = editor.draft;
  const canName = !b || b.actions.editName, canMeaning = !b || b.actions.editMeaning;
  const close = () => {
    if (busy || intent) return;
    if (!controller.dirty()) { controller.close(); return; }
    Alert.alert('¿Descartar cambios?', 'Todavía no guardaste esta métrica.', [
      { text: 'Seguir editando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => controller.close() },
    ]);
  };
  const confirm = (title: string, detail: string, action: string, run: () => void, destructive = false) =>
    Alert.alert(title, detail, [{ text: 'Cancelar', style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: run }]);
  const tone = phase === 'uncertain' || phase === 'confirmed' ? colors.text : phase === 'conflict' || phase === 'blocked' ? colors.danger : colors.text;
  const title = b ? b.name : 'Crear métrica';
  const subtitle = !b ? 'Elegí qué querés registrar cada día.' : b.systemKey ? 'Métrica del sistema' : b.isActive ? 'Métrica propia' : 'Métrica propia · archivada';
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} testID="metric-definition-editor">
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SheetHeader title={title} subtitle={subtitle} onClose={close} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {b?.systemKey ? <AppText muted variant="caption">En las métricas del sistema sólo se puede cambiar el objetivo. Su nombre, tipo y unidad son fijos.</AppText> : null}
          {b && !b.systemKey && b.hasHistory ? <AppText muted variant="caption">Tiene historial: podés cambiar el nombre o el objetivo y archivarla, pero no su tipo ni su unidad.</AppText> : null}
          <Field label="Nombre" value={d.name} editable={editable && canName} onChange={v => controller.change('name', v)} error={errors.name} placeholder="Ej.: Lectura" />
          <View style={styles.field}>
            <AppText variant="label">Tipo</AppText>
            <View style={styles.types} accessibilityRole="radiogroup">
              {METRIC_DEFINITION_VALUE_TYPES.map(type => {
                const selected = d.valueType === type;
                return <Pressable key={type} accessibilityRole="radio" accessibilityState={{ selected, disabled: !(editable && canMeaning) }} accessibilityLabel={VALUE_TYPE_LABELS[type]}
                  disabled={!(editable && canMeaning)} onPress={() => controller.change('valueType', type)}
                  style={[styles.type, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceRaised : colors.surface, opacity: editable && canMeaning ? 1 : 0.6 }]}>
                  <AppText variant="caption" style={selected ? { color: colors.primary } : undefined}>{VALUE_TYPE_LABELS[type]}</AppText>
                </Pressable>;
              })}
            </View>
          </View>
          {d.valueType === 'duration'
            ? <View style={styles.field}><AppText variant="label">Unidad</AppText><AppText muted variant="caption">Horas y minutos</AppText></View>
            : <Field label="Unidad" value={d.unit} editable={editable && canMeaning} onChange={v => controller.change('unit', v)} error={errors.unit} placeholder="Ej.: km, páginas, veces (opcional)" />}
          {d.valueType === 'duration' ? <View style={styles.field}>
            <AppText variant="label">Objetivo (opcional)</AppText>
            <View style={styles.duration}>
              <View style={styles.flex}><Field label="Objetivo horas" value={d.hours} editable={editable} keyboard="number-pad" onChange={v => controller.change('hours', v)} placeholder="h" /></View>
              <View style={styles.flex}><Field label="Objetivo minutos" value={d.minutes} editable={editable} keyboard="number-pad" onChange={v => controller.change('minutes', v)} placeholder="min" /></View>
            </View>
            {errors.target ? <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">{errors.target}</AppText> : null}
          </View> : <Field label="Objetivo (opcional)" value={d.target} editable={editable} keyboard={d.valueType === 'integer' ? 'number-pad' : 'decimal-pad'}
            onChange={v => controller.change('target', v)} error={errors.target} placeholder="Sin objetivo" />}
          <AppText muted variant="caption">El objetivo es una referencia actual: no cambia los valores ya registrados.</AppText>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {errors.form ? <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">{errors.form}</AppText> : null}
          {message ? <AppText accessibilityLiveRegion="polite" style={{ color: tone }} variant="caption">{message}</AppText> : null}
          {busy ? <View style={styles.row}><ActivityIndicator color={colors.primary} /><AppText muted variant="caption">Guardando…</AppText></View> : null}
          {phase === 'uncertain' ? <Button label="Comprobar" onPress={() => void controller.recover()} />
            : phase === 'confirmed' ? <Button label="Actualizar lectura" onPress={() => void controller.recover()} />
            : phase === 'conflict' ? <Button label="Revisar valores actuales" onPress={() => controller.reviewTruth()} />
            : phase === 'blocked' ? null
            : <Button label={busy ? 'Guardando…' : b ? 'Guardar' : 'Crear métrica'} disabled={busy || (!!b && !controller.dirty())} onPress={() => void controller.save()} />}
          {editable && b?.actions.archive ? <Button label="Archivar" variant="secondary" onPress={() => confirm('¿Archivar esta métrica?',
            'Deja de aparecer para registrar valores nuevos. Su historial se conserva y podés restaurarla.', 'Archivar', () => void controller.archive())} /> : null}
          {editable && b?.actions.restore ? <Button label="Restaurar" variant="secondary" onPress={() => confirm('¿Restaurar esta métrica?',
            'Vuelve a la lista activa, al final del orden.', 'Restaurar', () => void controller.restore())} /> : null}
          {editable && b?.actions.delete ? <Button label="Eliminar métrica" variant="quiet" onPress={() => confirm('¿Eliminar esta métrica?',
            'No tiene valores registrados. Esta acción no se puede deshacer.', 'Eliminar', () => void controller.remove(), true)} /> : null}
          {!intent && !busy ? <Button label="Cerrar" variant="quiet" onPress={close} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: { gap: spacing.xs },
  flex: { flex: 1 },
  types: { flexDirection: 'row', gap: spacing.sm },
  type: { flex: 1, minHeight: sizes.touchTarget, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  duration: { flexDirection: 'row', gap: spacing.sm },
});
