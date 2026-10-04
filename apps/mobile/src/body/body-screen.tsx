import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import type { BodyMeasurement, BodyWeightEntry } from '@/api/body';
import { AppIcon, AppText, Button, Heading, InlineUnavailable, ScrollScreen, SkeletonBlock, Surface, UnavailableState, spacing, useOwnlevelTheme } from '@/design-system';
import type { BodyController, BodyState } from './body-controller';
import { MeasurementEditorSheet, WeightEditorSheet } from './body-editor';
import { formatBodyDate, formatKg, measurementBadges, measurementValues } from './body-model';
import { useBodyController } from './use-body-controller';

function Row({ title, detail, badges, onPress, label, divided }: { title: string; detail: string; badges?: string[]; onPress?: () => void; label: string; divided: boolean }) {
  const { colors } = useOwnlevelTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress}
    style={({ pressed }) => [styles.row, divided ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null, pressed ? { backgroundColor: colors.surfaceRaised } : null]}>
    <View style={styles.flex}>
      <AppText variant="label">{title}</AppText>
      <AppText muted numberOfLines={2} variant="caption">{detail}</AppText>
      {badges?.map(b => <AppText key={b} style={{ color: colors.warning }} variant="caption">{b}</AppText>)}
    </View>
    {onPress ? <AppIcon color={colors.textMuted} name="chevronRight" size={14} /> : null}
  </Pressable>;
}

function WeightSection({ state, controller, editable }: { state: BodyState; controller: BodyController; editable: boolean }) {
  const { read } = state, overview = read.overview!;
  const current = overview.current;
  return <View style={styles.section} testID="body-weight-section">
    <Heading level={2}>Peso</Heading>
    <Surface style={styles.card}>
      <AppText muted variant="caption">Peso actual</AppText>
      {current ? <>
        <AppText style={styles.big} variant="label">{formatKg(current.weightKg)}</AppText>
        <AppText muted variant="caption">Último registro: {formatBodyDate(current.date)}</AppText>
      </> : overview.profileWeightKg !== null ? <>
        <AppText style={styles.big} variant="label">{formatKg(overview.profileWeightKg)}</AppText>
        <AppText muted variant="caption">Peso de perfil sin registro con fecha.</AppText>
      </> : <AppText muted>Todavía no registraste peso.</AppText>}
      <Button label="Registrar peso" disabled={!editable} onPress={() => controller.openWeight()} />
    </Surface>
    {read.weights.length ? <Surface style={styles.list}>
      {read.weights.map((entry: BodyWeightEntry, index) => <Row key={entry.date} divided={index > 0} title={formatBodyDate(entry.date)} detail={formatKg(entry.weightKg)}
        label={`Peso del ${formatBodyDate(entry.date)}: ${formatKg(entry.weightKg)}`} onPress={editable ? () => controller.openWeight(entry) : undefined} />)}
    </Surface> : null}
    {read.weightsCursor ? <Button label={read.loadingMore === 'weights' ? 'Cargando…' : 'Ver más pesos'} variant="secondary"
      disabled={read.loadingMore !== null} onPress={() => void controller.loadMore('weights')} /> : null}
  </View>;
}

function measurementSummary(m: BodyMeasurement) {
  const values = measurementValues(m).map(v => `${v.label} ${v.value}`);
  return values.join(' · ') || 'Sin valores';
}
function MeasurementSection({ state, controller, editable }: { state: BodyState; controller: BodyController; editable: boolean }) {
  const { colors } = useOwnlevelTheme();
  const { read } = state, latest = read.measurements[0];
  return <View style={styles.section} testID="body-measurement-section">
    <Heading level={2}>Medidas</Heading>
    <Surface style={styles.card}>
      <AppText muted variant="caption">Última medición</AppText>
      {latest ? <>
        <AppText variant="label">{formatBodyDate(latest.measuredOn)}</AppText>
        {measurementValues(latest).map(v => <View key={v.field} style={styles.value}><AppText muted variant="caption">{v.label}</AppText><AppText variant="caption">{v.value}</AppText></View>)}
        {measurementBadges(latest).map(b => <AppText key={b.text} style={{ color: b.tone === 'warning' ? colors.warning : colors.textMuted }} variant="caption">{b.text}</AppText>)}
      </> : <AppText muted>Todavía no registraste medidas.</AppText>}
      <Button label="Registrar medidas" disabled={!editable} onPress={() => controller.openMeasurement()} />
    </Surface>
    {read.measurements.length ? <Surface style={styles.list}>
      {read.measurements.map((m, index) => <Row key={m.id} divided={index > 0} title={formatBodyDate(m.measuredOn)} detail={measurementSummary(m)}
        badges={measurementBadges(m).map(b => b.text)} label={`Medición del ${formatBodyDate(m.measuredOn)}`}
        onPress={editable ? () => controller.openMeasurement(m) : undefined} />)}
    </Surface> : null}
    {read.measurementsCursor ? <Button label={read.loadingMore === 'measurements' ? 'Cargando…' : 'Ver más mediciones'} variant="secondary"
      disabled={read.loadingMore !== null} onPress={() => void controller.loadMore('measurements')} /> : null}
  </View>;
}

export function BodyView({ state, controller }: { state: BodyState; controller: BodyController }) {
  const { colors } = useOwnlevelTheme();
  const { read, editor } = state;
  if (!read.overview) {
    return <ScrollScreen testID={read.status === 'loading' ? 'body-loading' : 'body-unavailable'}>
      {read.status === 'loading' ? <><SkeletonBlock height={140} /><SkeletonBlock height={140} /></>
        : <UnavailableState title="No pudimos cargar Cuerpo" description="Tus datos siguen seguros. Revisá la conexión e intentá nuevamente."
          action={<Button label="Reintentar" onPress={() => void controller.load()} />} />}
    </ScrollScreen>;
  }
  const editable = state.phase === 'idle' && !state.intent && !editor;
  return <>
    <ScrollScreen testID="body-screen" refreshControl={<RefreshControl refreshing={read.refreshing} onRefresh={() => void controller.load()} tintColor={colors.primary} />}>
      {read.stale ? <Surface><InlineUnavailable actionLabel="Reintentar" message="No se pudo actualizar. Mostramos la última lectura confirmada." onAction={() => void controller.load()} /></Surface> : null}
      {state.notice ? <Surface accessibilityRole="alert"><AppText variant="caption">{state.notice}</AppText>
        <Button label="Entendido" variant="quiet" onPress={() => controller.dismissNotice()} /></Surface> : null}
      {state.intent && !editor ? <Surface><AppText variant="caption">{state.message ?? 'Hay un cambio pendiente de confirmar.'}</AppText>
        <Button label="Comprobar" onPress={() => void controller.recover()} /></Surface> : null}
      {state.phase === 'blocked' && !editor ? <Surface><AppText style={{ color: colors.danger }} variant="caption">{state.message}</AppText></Surface> : null}
      {read.moreError ? <AppText style={{ color: colors.danger }} variant="caption">No pudimos cargar más registros. Probá de nuevo.</AppText> : null}
      <WeightSection state={state} controller={controller} editable={editable} />
      <MeasurementSection state={state} controller={controller} editable={editable} />
    </ScrollScreen>
    {editor?.kind === 'weight' ? <WeightEditorSheet editor={editor} state={state} controller={controller} /> : null}
    {editor?.kind === 'measurement' ? <MeasurementEditorSheet editor={editor} state={state} controller={controller} /> : null}
  </>;
}

export function BodyScreen() {
  const { session } = useMobileAuth();
  const userId = session?.user.id ?? 'anonymous';
  return <BodyUserScreen key={userId} userId={userId} />;
}
function BodyUserScreen({ userId }: { userId: string }) {
  const { client } = useMobileApi();
  const body = useBodyController(client, userId);
  if (!body) return <ScrollScreen testID="body-loading"><SkeletonBlock height={140} /></ScrollScreen>;
  return <BodyView state={body.state} controller={body.controller} />;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { gap: spacing.xs },
  big: { fontSize: 28, lineHeight: 34 },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1, gap: 2 },
  value: { flexDirection: 'row', justifyContent: 'space-between' },
});
