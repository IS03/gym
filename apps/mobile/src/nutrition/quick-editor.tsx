import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Heading, LoadingState, ScrollScreen, Surface, spacing, useOwnlevelTheme } from '@/design-system';
import type { QuickNutrients, QuickSection } from '@/api/nutrition-quick';
import { displayNutritionDate } from './day-format';
import type { QuickController, QuickState } from './quick-controller';
const shown = (v: number | null) => v === null ? 'sin dato' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(v);
function Nutrients({ value }: { value: QuickNutrients }) {
  return <AppText selectable>{`${shown(value.calories)} kcal · P ${shown(value.proteinG)} · C ${shown(value.carbsG)} · G ${shown(value.fatG)}`}</AppText>;
}
export function QuickEditor({ controller, state }: { controller: QuickController; state: QuickState }) {
  const { colors } = useOwnlevelTheme();
  if (!state.open || !state.date) return null;
  const running = state.phase === 'pending' || state.phase === 'loading';
  const locked = !!state.intent || state.phase !== 'idle';
  const close = () => {
    if (running) return;
    if (!state.intent && controller.dirty()) Alert.alert('¿Descartar ajustes?', 'Estas cantidades todavía no se registraron.', [
      { text: 'Seguir revisando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => controller.close() },
    ]); else controller.close();
  };
  const section = (title: string, data: QuickSection | undefined) => <Surface>
    <Heading level={2}>{title}</Heading>
    {data?.status === 'unavailable' ? <AppText>No pudimos cargar estas opciones.</AppText>
      : data?.status === 'ok' ? data.items.length ? data.items.map(option => <View key={option.source.id} style={styles.option}>
        <AppText variant="label">{option.name}</AppText>
        <Nutrients value={option} />
        {option.useCount !== null ? <AppText muted>{`${option.useCount} veces · Última vez ${displayNutritionDate(option.lastUsedDate!)}`}</AppText> : null}
        {option.items.length ? <AppText muted>{`${option.items.length} ingredientes · Se pueden ajustar para esta vez`}</AppText> : null}
        <Button label={`Revisar ${option.name}`} onPress={() => controller.choose(option)} variant="secondary" />
      </View>) : <AppText>{title === 'Guardadas' ? 'Todavía no tenés habituales activas.' : 'No hay sugeridas de los 60 días anteriores a hoy.'}</AppText>
      : null}
  </Surface>;
  return <Modal animationType="slide" presentationStyle="fullScreen" visible onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollScreen safeAreaEdges={['top','left','right','bottom']} testID="quick-meal-editor">
        <Heading level={2}>Agregar rápido</Heading>
        <AppText variant="label">{`Destino · ${displayNutritionDate(state.date)}`}</AppText>
        {!state.draft ? <>
          {state.optionsLoading ? <LoadingState label="Cargando opciones rápidas" /> : null}
          {state.optionsError ? <AppText accessibilityRole="alert">No pudimos actualizar las opciones. Podés reintentar.</AppText> : null}
          {section('Guardadas', state.options?.saved)}
          {section('Sugeridas', state.options?.suggested)}
          <Button disabled={state.optionsLoading} label="Actualizar opciones" onPress={() => void controller.loadOptions()} variant="secondary" />
        </> : <>
          <Heading level={2}>{state.draft.option.name}</Heading>
          {state.draft.option.templateType === 'composite' ? <AppText muted>Las cantidades se aplican sólo a esta comida. La habitual no se modifica.</AppText> : null}
          {state.draft.option.items.map(item => <View style={styles.field} key={item.id}>
            <AppText variant="label">{`${item.label} (${item.unit})`}</AppText>
            <TextInput accessibilityLabel={`Cantidad de ${item.label}`} editable={!locked} keyboardType="decimal-pad"
              value={state.draft!.quantities[item.id]} onChangeText={value => controller.change(item.id, value)}
              style={[styles.input, { color: colors.text, borderColor: state.errors[item.id] ? colors.danger : colors.border }]} />
            {state.errors[item.id] ? <AppText accessibilityRole="alert">{state.errors[item.id]}</AppText> : null}
          </View>)}
          {state.previousDraft?.option.items.length ? <Surface>
            <AppText variant="label">Tus cantidades anteriores, para revisar</AppText>
            {state.previousDraft.option.items.map(i => <AppText key={i.id}>{`${i.label}: ${state.previousDraft!.quantities[i.id]} ${i.unit}`}</AppText>)}
          </Surface> : null}
          {state.previewLoading ? <LoadingState label="Calculando vista previa" /> : null}
          {state.preview ? <Surface testID="quick-preview">
            <Heading level={2}>Se registrará</Heading>
            {state.preview.snapshot.description ? <AppText selectable>{state.preview.snapshot.description}</AppText> : null}
            <Nutrients value={state.preview.snapshot} />
          </Surface> : null}
          {state.phase === 'idle' ? <>
            <Button disabled={state.previewLoading} label="Actualizar vista previa" onPress={() => void controller.requestPreview()} variant="secondary" />
            <Button disabled={!state.preview || state.previewLoading} label="Registrar comida" onPress={() => void controller.save()} />
            {state.draft.option.source.kind === 'suggestion' ? <Button disabled={!state.preview || state.previewLoading}
              label="Guardar como habitual" onPress={() => void controller.save('saveSuggestion')} variant="secondary" /> : null}
            <Button label="Elegir otra opción" onPress={() => {
              if (controller.dirty()) Alert.alert('¿Descartar ajustes?', 'Podés volver a elegir otra opción.', [
                { text: 'Cancelar', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => controller.back() },
              ]); else controller.back();
            }} variant="quiet" />
          </> : null}
        </>}
        {state.message ? <AppText accessibilityRole="alert" selectable>{state.message}</AppText> : null}
        {state.phase === 'conflict' ? <Surface>
          {state.truth ? <><AppText variant="label">Versión actual del servidor</AppText><AppText>{state.truth.name}</AppText><Nutrients value={state.truth} />
            <Button label="Revisar la versión actual" onPress={() => controller.reviewTruth()} variant="secondary" /></>
            : <AppText>No hay una opción actual confirmada. Conservamos tu selección y cantidades.</AppText>}
          <Button disabled={state.optionsLoading} label="Actualizar fuente" onPress={() => void controller.loadOptions()} variant="secondary" />
          <Button label="Elegir otra opción" onPress={() => controller.back()} variant="quiet" />
        </Surface> : null}
        {['uncertain','confirmed','blocked'].includes(state.phase) ? <Button label={state.intent?.receipt ? 'Actualizar datos confirmados' : 'Comprobar intento guardado'} onPress={() => void controller.recover()} /> : null}
        {running ? <Button label="Procesando…" disabled onPress={() => {}} /> : null}
        <Button disabled={running} label={state.intent ? 'Volver al día · conservar intento' : 'Cancelar'} onPress={close} variant="quiet" />
      </ScrollScreen>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, option: { gap: spacing.sm, paddingVertical: spacing.sm }, field: { gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 17 } });
