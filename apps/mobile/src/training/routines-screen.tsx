import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createMobileTrainingRoutine,
  fetchMobileTrainingRoutines,
  importMobileTrainingInitialPlan,
  setMobileTrainingRoutineStatus,
  useApiResource,
  useMobileApi,
} from '@/api';
import type { MobileRoutineColorKey } from '@/api/home';
import type { MobileTrainingRoutine } from '@/api/routines';
import type { MobileApiMutationResult } from '@/api/results';
import {
  AppIcon,
  AppText,
  Button,
  EmptyState,
  Heading,
  InlineUnavailable,
  ScrollScreen,
  Separator,
  SkeletonBlock,
  Surface,
  UnavailableState,
  radius,
  sizes,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';
import { haptics } from '@/platform/haptics';

import { trainingRoutineColor, trainingRoutineColorLabel } from './routine-colors';

const ROUTINE_COLORS: MobileRoutineColorKey[] = [
  'violet',
  'indigo',
  'blue',
  'cyan',
  'green',
  'yellow',
  'orange',
  'rose',
];

type MutationKind = 'archive' | 'create' | 'initialPlan' | 'restore';
type PendingMutation = { kind: MutationKind; routineId?: string } | null;

function defaultIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `routine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mutationErrorMessage(result: MobileApiMutationResult<unknown>): string {
  if (result.status === 'validation' || result.status === 'not_found') {
    return result.message;
  }
  if (result.status === 'conflict') {
    return 'Este intento ya fue usado con otros datos. Cambiá el formulario e intentá nuevamente.';
  }
  if (result.status === 'auth_required' || result.status === 'unauthorized') {
    return 'Tu sesión necesita volver a validarse.';
  }
  return 'No pudimos completar la acción. Revisá la conexión e intentá nuevamente.';
}

function pluralCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function RoutineRow({
  pending,
  routine,
  onOpen,
  onSetStatus,
}: {
  pending: boolean;
  routine: MobileTrainingRoutine;
  onOpen: (routine: MobileTrainingRoutine) => void;
  onSetStatus: (routine: MobileTrainingRoutine) => void;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const metadata = `${pluralCount(routine.exerciseCount, 'ejercicio', 'ejercicios')} · ${pluralCount(routine.setCount, 'serie', 'series')}`;

  return (
    <View style={styles.routineRow} testID={`routine-row-${routine.id}`}>
      <View
        accessibilityElementsHidden
        style={[
          styles.colorStrip,
          {
            backgroundColor: routine.color
              ? trainingRoutineColor(routine.color, isDark)
              : colors.unavailable,
          },
        ]}
        testID={`routine-color-${routine.id}-${routine.color ?? 'none'}`}
      />
      <Pressable
        accessibilityHint="Abre el editor de rutina"
        accessibilityLabel={`Abrir rutina ${routine.name}, ${metadata}`}
        accessibilityRole="button"
        onPress={() => onOpen(routine)}
        style={({ pressed }) => [styles.routineMain, { opacity: pressed ? 0.65 : 1 }]}
      >
        <View style={styles.routineCopy}>
          <AppText numberOfLines={2} testID="routine-name" variant="label">
            {routine.name}
          </AppText>
          <AppText muted variant="caption">
            {metadata}
          </AppText>
          {!routine.isActive ? (
            <AppText muted variant="overline">ARCHIVADA</AppText>
          ) : null}
        </View>
        <AppIcon color={colors.textMuted} name="chevronRight" size={15} />
      </Pressable>
      <Pressable
        accessibilityHint="Muestra las acciones de esta rutina"
        accessibilityLabel={`Más acciones para ${routine.name}`}
        accessibilityRole="button"
        disabled={pending}
        onPress={() => onSetStatus(routine)}
        style={({ pressed }) => [
          styles.rowAction,
          { opacity: pending ? 0.45 : pressed ? 0.6 : 1 },
        ]}
      >
        <AppText style={[styles.overflowLabel, { color: colors.textMuted }]}>
          {pending ? '···' : '•••'}
        </AppText>
      </Pressable>
    </View>
  );
}

function RoutineList({
  pending,
  routines,
  onOpen,
  onSetStatus,
}: {
  pending: PendingMutation;
  routines: MobileTrainingRoutine[];
  onOpen: (routine: MobileTrainingRoutine) => void;
  onSetStatus: (routine: MobileTrainingRoutine) => void;
}) {
  return (
    <Surface elevated style={styles.routineList}>
      {routines.map((routine, index) => (
        <View key={routine.id}>
          {index > 0 ? <Separator /> : null}
          <RoutineRow
            onOpen={onOpen}
            onSetStatus={onSetStatus}
            pending={pending?.routineId === routine.id}
            routine={routine}
          />
        </View>
      ))}
    </Surface>
  );
}

function CollapsibleHeader({
  expanded,
  label,
  onPress,
}: {
  expanded: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityLabel={`${expanded ? 'Contraer' : 'Expandir'} ${label}`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.collapsibleHeader, { opacity: pressed ? 0.65 : 1 }]}
    >
      <AppText variant="label">{label}</AppText>
      <View style={[styles.disclosure, expanded && styles.disclosureExpanded]}>
        <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
      </View>
    </Pressable>
  );
}

function CreateRoutineModal({
  createIdempotencyKey,
  onClose,
  onSubmit,
  pending,
  visible,
}: {
  createIdempotencyKey: () => string;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    color: MobileRoutineColorKey;
    idempotencyKey: string;
  }) => Promise<string | null>;
  pending: boolean;
  visible: boolean;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<MobileRoutineColorKey>('violet');
  const [error, setError] = useState<string | null>(null);
  const submissionKey = useRef<string | null>(null);

  const resetIntent = () => {
    submissionKey.current = null;
    setError(null);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Ingresá un nombre para la rutina.');
      return;
    }
    const key = submissionKey.current ?? createIdempotencyKey();
    submissionKey.current = key;
    const submitError = await onSubmit({
      name: trimmedName,
      color,
      idempotencyKey: key,
    });
    if (submitError) setError(submitError);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={pending ? undefined : onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView style={[styles.modalScreen, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalScreen}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <View style={styles.routineCopy}>
                <Heading level={2}>Nueva rutina</Heading>
                <AppText muted>
                  Definí su identidad. Después vas a poder agregar y ordenar ejercicios.
                </AppText>
              </View>
              <Pressable
                accessibilityLabel="Cerrar nueva rutina"
                accessibilityRole="button"
                disabled={pending}
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
              >
                <AppText style={styles.closeLabel}>×</AppText>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <AppText variant="label">Nombre</AppText>
              <TextInput
                accessibilityLabel="Nombre de la rutina"
                autoCapitalize="words"
                autoFocus
                editable={!pending}
                onChangeText={(value) => {
                  setName(value);
                  resetIntent();
                }}
                onSubmitEditing={() => void submit()}
                placeholder="Ej: Push B"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={name}
              />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="label">Color</AppText>
              <View accessibilityRole="radiogroup" style={styles.swatchGrid}>
                {[ROUTINE_COLORS.slice(0, 4), ROUTINE_COLORS.slice(4, 8)].map(
                  (row, rowIndex) => (
                    <View
                      key={`swatch-row-${rowIndex}`}
                      style={styles.swatchRow}
                      testID="routine-color-row"
                    >
                      {row.map((option) => {
                        const selected = color === option;
                        const swatchColor = trainingRoutineColor(option, isDark);
                        return (
                          <Pressable
                            accessibilityLabel={trainingRoutineColorLabel(option)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            disabled={pending}
                            key={option}
                            onPress={() => {
                              haptics.selection();
                              setColor(option);
                              resetIntent();
                            }}
                            style={({ pressed }) => [
                              styles.swatchTarget,
                              selected && { borderColor: colors.text },
                              { opacity: pressed ? 0.65 : 1 },
                            ]}
                          >
                            <View style={[styles.swatch, { backgroundColor: swatchColor }]}>
                              {selected ? (
                                <AppIcon
                                  color={option === 'yellow' ? '#17131F' : '#FFFFFF'}
                                  name="check"
                                  size={21}
                                />
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ),
                )}
              </View>
            </View>

            {error ? (
              <AppText accessibilityRole="alert" style={{ color: colors.danger }} variant="caption">
                {error}
              </AppText>
            ) : null}

            <Button
              disabled={pending}
              label={pending ? 'Creando…' : 'Crear rutina'}
              onPress={() => void submit()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function RoutinesSkeleton() {
  return (
    <ScrollScreen testID="routines-loading">
      <SkeletonBlock height={48} width="90%" />
      <SkeletonBlock height={24} width={120} />
      <Surface elevated>
        <SkeletonBlock height={64} />
        <SkeletonBlock height={64} />
        <SkeletonBlock height={64} />
      </Surface>
      <SkeletonBlock height={44} />
      <SkeletonBlock height={44} />
    </ScrollScreen>
  );
}

export function RoutinesScreen({
  createIdempotencyKey = defaultIdempotencyKey,
}: {
  createIdempotencyKey?: () => string;
}) {
  const { client } = useMobileApi();
  const router = useRouter();
  const { colors } = useOwnlevelTheme();
  const insets = useSafeAreaInsets();
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState<PendingMutation>(null);

  const load = useCallback(
    (signal: AbortSignal) => {
      if (!client) {
        return Promise.resolve({
          status: 'unavailable' as const,
          reason: 'invalid_response' as const,
          meta: {
            durationMs: 0,
            httpStatus: null,
            outcome: 'unavailable' as const,
          },
        });
      }
      return fetchMobileTrainingRoutines(client, signal);
    },
    [client],
  );
  const { refresh, state } = useApiResource(load);
  const current = state.status === 'ready'
    ? state.current
    : state.status === 'loading'
      ? undefined
      : state.previous;
  const routineResource = current?.data.routines;
  const sortedRoutines = useMemo(
    () => routineResource?.status === 'ok'
      ? [...routineResource.data].sort((left, right) => left.order - right.order)
      : [],
    [routineResource],
  );
  const active = sortedRoutines.filter((routine) => routine.isActive);
  const archived = sortedRoutines.filter((routine) => !routine.isActive);

  const announce = useCallback((message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    void AccessibilityInfo.announceForAccessibility(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 3_500);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const runRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const openEditorFeedback = useCallback((routine: MobileTrainingRoutine) => {
    haptics.selection();
    router.push({ pathname: '/(tabs)/train/routines/[id]', params: { id: routine.id } });
  }, [router]);

  const setRoutineStatus = useCallback((routine: MobileTrainingRoutine) => {
    if (!client || pending) return;
    const restoring = !routine.isActive;
    const action = restoring ? 'Restaurar' : 'Archivar';
    Alert.alert(
      `${action} ${routine.name}`,
      restoring
        ? 'La rutina volverá a aparecer entre las activas.'
        : 'Las sesiones anteriores se conservan sin cambios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action,
          style: restoring ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setPending({ kind: restoring ? 'restore' : 'archive', routineId: routine.id });
              const result = await setMobileTrainingRoutineStatus(
                client,
                routine.id,
                restoring,
              );
              if (result.status === 'ok') {
                announce(restoring ? 'Rutina restaurada.' : 'Rutina archivada.');
                await refresh();
              } else {
                announce(mutationErrorMessage(result));
              }
              setPending(null);
            })();
          },
        },
      ],
    );
  }, [announce, client, pending, refresh]);

  const createRoutine = useCallback(async (input: {
    name: string;
    color: MobileRoutineColorKey;
    idempotencyKey: string;
  }): Promise<string | null> => {
    if (!client || pending) return 'Esperá a que termine la acción actual.';
    setPending({ kind: 'create' });
    const result = await createMobileTrainingRoutine(client, input);
    if (result.status === 'ok') {
      setCreateVisible(false);
      announce('Rutina creada.');
      await refresh();
      setPending(null);
      return null;
    }
    const message = mutationErrorMessage(result);
    setPending(null);
    return message;
  }, [announce, client, pending, refresh]);

  const confirmInitialPlan = useCallback(() => {
    if (!client || pending) return;
    Alert.alert(
      'Restaurar plan inicial',
      'Vuelve a importar las rutinas iniciales sin modificar entrenamientos ya guardados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: () => {
            void (async () => {
              setPending({ kind: 'initialPlan' });
              const result = await importMobileTrainingInitialPlan(client);
              if (result.status === 'ok') {
                announce(
                  `Plan inicial restaurado: ${pluralCount(result.data.routines, 'rutina', 'rutinas')} y ${pluralCount(result.data.exercises, 'ejercicio', 'ejercicios')}.`,
                );
                await refresh();
              } else {
                announce(mutationErrorMessage(result));
              }
              setPending(null);
            })();
          },
        },
      ],
    );
  }, [announce, client, pending, refresh]);

  const openCreate = useCallback(() => {
    haptics.selection();
    setCreateVisible(true);
  }, []);

  if (!current && state.status === 'loading') return <RoutinesSkeleton />;

  if (!current) {
    return (
      <ScrollScreen testID="routines-unavailable">
        <UnavailableState
          action={<Button label="Reintentar" onPress={runRefresh} />}
          description="Tus rutinas siguen seguras. Revisá la conexión e intentá nuevamente."
          title="No pudimos cargar Rutinas"
        />
      </ScrollScreen>
    );
  }

  const resources = current.data;
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Nueva rutina"
              accessibilityRole="button"
              hitSlop={8}
              onPress={openCreate}
            >
              <AppText style={{ color: colors.primary }} variant="label">+ Nueva</AppText>
            </Pressable>
          ),
          title: 'Rutinas',
        }}
      />
      <ScrollScreen
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={runRefresh}
            progressBackgroundColor={colors.surface}
            refreshing={state.status === 'ready' && state.refreshing}
            tintColor={colors.primary}
          />
        }
        testID="routines-screen"
      >
        <AppText muted>
          Organizá tus rutinas. Editarlas no modifica sesiones anteriores.
        </AppText>

        {state.status !== 'ready' ? (
          <Surface style={styles.noticeSurface} testID="routines-stale">
            <InlineUnavailable
              actionLabel="Reintentar"
              message="No se pudo actualizar. Mostramos la última lectura confirmada."
              onAction={runRefresh}
            />
          </Surface>
        ) : null}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>Activas</AppText>
            {resources.routines.status === 'ok' ? (
              <AppText muted variant="caption">
                {pluralCount(active.length, 'activa', 'activas')}
              </AppText>
            ) : null}
          </View>
          {resources.routines.status === 'unavailable' ? (
            <Surface>
              <InlineUnavailable
                actionLabel="Reintentar"
                message="No pudimos cargar la lista de rutinas."
                onAction={runRefresh}
              />
            </Surface>
          ) : active.length === 0 ? (
            <EmptyState
              action={<Button label="Crear nueva" onPress={openCreate} />}
              description="Creá una nueva o restaurá una archivada."
              title="No tenés rutinas activas."
            />
          ) : (
            <RoutineList
              onOpen={openEditorFeedback}
              onSetStatus={setRoutineStatus}
              pending={pending}
              routines={active}
            />
          )}
        </View>

        {resources.routines.status === 'ok' ? (
          <View style={styles.section}>
            <CollapsibleHeader
              expanded={archivedExpanded}
              label={`Archivadas · ${archived.length}`}
              onPress={() => setArchivedExpanded((value) => !value)}
            />
            {archivedExpanded ? (
              archived.length > 0 ? (
                <RoutineList
                  onOpen={openEditorFeedback}
                  onSetStatus={setRoutineStatus}
                  pending={pending}
                  routines={archived}
                />
              ) : (
                <AppText muted variant="caption">No hay rutinas archivadas.</AppText>
              )
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <CollapsibleHeader
            expanded={advancedExpanded}
            label="Opciones avanzadas"
            onPress={() => setAdvancedExpanded((value) => !value)}
          />
          {advancedExpanded ? (
            <Surface style={styles.advancedSurface}>
              <View style={styles.routineCopy}>
                <AppText variant="label">Restaurar plan inicial</AppText>
                <AppText muted variant="caption">
                  Vuelve a importar las rutinas iniciales sin modificar entrenamientos ya guardados.
                </AppText>
                {resources.initialPlan.status === 'ok' ? (
                  <AppText muted variant="caption">
                    {resources.initialPlan.data.imported
                      ? `Plan importado · ${pluralCount(resources.initialPlan.data.routinesFound, 'rutina encontrada', 'rutinas encontradas')}`
                      : 'El plan inicial todavía no fue importado.'}
                  </AppText>
                ) : null}
              </View>
              {resources.initialPlan.status === 'unavailable' ? (
                <InlineUnavailable
                  actionLabel="Reintentar"
                  message="No pudimos verificar el estado del plan inicial."
                  onAction={runRefresh}
                />
              ) : (
                <Button
                  disabled={pending !== null}
                  label={pending?.kind === 'initialPlan' ? 'Restaurando…' : 'Restaurar plan inicial'}
                  onPress={confirmInitialPlan}
                  variant="secondary"
                />
              )}
            </Surface>
          ) : null}
        </View>
      </ScrollScreen>

      {notice ? (
        <View
          pointerEvents="none"
          style={[styles.toastContainer, { bottom: insets.bottom + spacing.xxxl }]}
        >
          <Surface accessibilityRole="alert" elevated style={styles.toastSurface}>
            <AppText variant="caption">{notice}</AppText>
          </Surface>
        </View>
      ) : null}

      {createVisible ? (
        <CreateRoutineModal
          createIdempotencyKey={createIdempotencyKey}
          onClose={() => setCreateVisible(false)}
          onSubmit={createRoutine}
          pending={pending?.kind === 'create'}
          visible
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  advancedSurface: {
    gap: spacing.lg,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: sizes.touchTarget,
    justifyContent: 'center',
    width: sizes.touchTarget,
  },
  closeLabel: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  collapsibleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget,
  },
  colorStrip: {
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    marginVertical: spacing.sm,
    width: 3,
  },
  disclosure: {
    transform: [{ rotate: '0deg' }],
  },
  disclosureExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  formGroup: {
    gap: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalContent: {
    gap: spacing.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalScreen: {
    flex: 1,
  },
  noticeSurface: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  routineCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  routineList: {
    gap: 0,
    overflow: 'hidden',
    padding: 0,
  },
  routineMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  routineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 72,
    paddingLeft: spacing.md,
  },
  rowAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: spacing.xs,
  },
  overflowLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 22,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  swatch: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  swatchGrid: {
    gap: spacing.md,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swatchTarget: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  toastContainer: {
    alignItems: 'center',
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
  },
  toastSurface: {
    maxWidth: 520,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
});
