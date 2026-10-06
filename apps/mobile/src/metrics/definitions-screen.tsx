import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import type { MetricDefinition } from '@/api/metric-definitions';
import { AppIcon, AppText, Button, Heading, InlineUnavailable, ScrollScreen, SkeletonBlock, Surface, UnavailableState, spacing, useOwnlevelTheme } from '@/design-system';
import type { DefinitionsController, DefinitionsState } from './definitions-controller';
import { DefinitionEditorSheet } from './definitions-editor';
import { activeDefinitions, archivedDefinitions, definitionSummary } from './definitions-model';
import { useDefinitionsController } from './use-definitions-controller';

function MoveButton({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useOwnlevelTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={6}
    style={[styles.move, { borderColor: colors.border, opacity: disabled ? 0.3 : 1 }]}>
    <AppText variant="label">{glyph}</AppText>
  </Pressable>;
}
function DefinitionRow({ definition, divided, editable, onOpen, move }: {
  definition: MetricDefinition; divided: boolean; editable: boolean; onOpen: () => void;
  move?: { first: boolean; last: boolean; up: () => void; down: () => void };
}) {
  const { colors } = useOwnlevelTheme();
  const tag = definition.systemKey ? 'Sistema' : 'Propia';
  return <View testID={`metric-definition-${definition.id}`}
    style={[styles.row, divided ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}>
    {move ? <View style={styles.moves}>
      <MoveButton label={`Subir ${definition.name}`} glyph="↑" disabled={!editable || move.first} onPress={move.up} />
      <MoveButton label={`Bajar ${definition.name}`} glyph="↓" disabled={!editable || move.last} onPress={move.down} />
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${definition.name}`} disabled={!editable} onPress={onOpen}
      style={({ pressed }) => [styles.open, pressed ? { backgroundColor: colors.surfaceRaised } : null]}>
      <View style={styles.flex}>
        <AppText variant="label">{definition.name}</AppText>
        <AppText muted numberOfLines={2} variant="caption">{definitionSummary(definition)}</AppText>
        <AppText muted variant="caption">{`${tag}${definition.isActive ? '' : ' · Archivada'}${definition.hasHistory ? ' · Con historial' : ''}`}</AppText>
      </View>
      <AppIcon color={colors.textMuted} name="chevronRight" size={14} />
    </Pressable>
  </View>;
}

export function DefinitionsView({ state, controller }: { state: DefinitionsState; controller: DefinitionsController }) {
  const { colors } = useOwnlevelTheme();
  const { read, editor } = state;
  if (!read.definitions) {
    return <ScrollScreen testID={read.status === 'loading' ? 'metric-definitions-loading' : 'metric-definitions-unavailable'}>
      {read.status === 'loading' ? <><SkeletonBlock height={120} /><SkeletonBlock height={120} /></>
        : <UnavailableState title="No pudimos cargar tus métricas" description="Tus datos siguen seguros. Revisá la conexión e intentá nuevamente."
          action={<Button label="Reintentar" onPress={() => void controller.load()} />} />}
    </ScrollScreen>;
  }
  const editable = state.phase === 'idle' && !state.intent && !editor;
  const active = activeDefinitions(read.definitions), archived = archivedDefinitions(read.definitions);
  return <>
    <ScrollScreen testID="metric-definitions-screen" refreshControl={<RefreshControl refreshing={read.refreshing} onRefresh={() => void controller.load()} tintColor={colors.primary} />}>
      <View style={styles.section}>
        <Heading>Administrar métricas</Heading>
        <AppText muted variant="caption">Elegí qué registrás cada día y en qué orden. Las métricas con historial se archivan para conservar sus registros.</AppText>
      </View>
      {read.stale ? <Surface><InlineUnavailable actionLabel="Reintentar" message="No se pudo actualizar. Mostramos la última lectura confirmada." onAction={() => void controller.load()} /></Surface> : null}
      {state.notice ? <Surface accessibilityRole="alert"><AppText variant="caption">{state.notice}</AppText>
        <Button label="Entendido" variant="quiet" onPress={() => controller.dismissNotice()} /></Surface> : null}
      {state.phase === 'pending' && !editor ? <Surface><AppText muted variant="caption">Guardando…</AppText></Surface> : null}
      {state.intent && !editor && state.phase !== 'pending' ? <Surface><AppText variant="caption">{state.message ?? 'Hay un cambio pendiente de confirmar.'}</AppText>
        <Button label="Comprobar" onPress={() => void controller.recover()} /></Surface> : null}
      {!state.intent && !editor && state.message && state.phase === 'idle' ? <Surface accessibilityRole="alert">
        <AppText style={{ color: colors.text }} variant="caption">{state.message}</AppText></Surface> : null}
      {state.phase === 'blocked' && !editor ? <Surface><AppText style={{ color: colors.danger }} variant="caption">{state.message}</AppText></Surface> : null}
      <View style={styles.section} testID="metric-definitions-active">
        <Heading level={2}>Activas</Heading>
        {active.length ? <Surface style={styles.list}>
          {active.map((d, index) => <DefinitionRow key={d.id} definition={d} divided={index > 0} editable={editable} onOpen={() => controller.openEdit(d)}
            move={{ first: index === 0, last: index === active.length - 1, up: () => void controller.move(d.id, -1), down: () => void controller.move(d.id, 1) }} />)}
        </Surface> : <AppText muted>No tenés métricas activas.</AppText>}
        <Button label="Crear métrica" disabled={!editable} onPress={() => controller.openCreate()} />
      </View>
      <View style={styles.section} testID="metric-definitions-archived">
        <Heading level={2}>Archivadas</Heading>
        {archived.length ? <Surface style={styles.list}>
          {archived.map((d, index) => <DefinitionRow key={d.id} definition={d} divided={index > 0} editable={editable} onOpen={() => controller.openEdit(d)} />)}
        </Surface> : <AppText muted>No tenés métricas archivadas.</AppText>}
      </View>
    </ScrollScreen>
    {editor ? <DefinitionEditorSheet editor={editor} state={state} controller={controller} /> : null}
  </>;
}

/** Reusable "Administrar métricas" surface (route /settings/metrics; M8 links here too). */
export function MetricDefinitionsScreen() {
  const { session } = useMobileAuth();
  const userId = session?.user.id ?? 'anonymous';
  return <MetricDefinitionsUserScreen key={userId} userId={userId} />;
}
function MetricDefinitionsUserScreen({ userId }: { userId: string }) {
  const { client } = useMobileApi();
  const definitions = useDefinitionsController(client, userId);
  if (!definitions) return <ScrollScreen testID="metric-definitions-loading"><SkeletonBlock height={120} /></ScrollScreen>;
  return <DefinitionsView state={definitions.state} controller={definitions.controller} />;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm },
  moves: { gap: spacing.xs },
  move: { width: 32, height: 28, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1, gap: 2 },
});
