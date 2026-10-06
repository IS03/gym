import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createMobileTrainingExercise,
  fetchMobileTrainingExercises,
  setMobileTrainingExerciseStatus,
  updateMobileTrainingExercise,
  useApiResource,
  useMobileApi,
} from '@/api';
import type {
  MobileTrainingExercise,
  MobileTrainingExerciseMutation,
  MobileTrainingExerciseRoutine,
} from '@/api/exercises';
import type { MobileApiMutationResult } from '@/api/results';
import {
  AppIcon,
  AppText,
  Button,
  EmptyState,
  InlineUnavailable,
  ScrollScreen,
  Separator,
  SkeletonBlock,
  Surface,
  UnavailableState,
  radius,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';
import { haptics } from '@/platform/haptics';

import {
  ExerciseEditorModal,
  type ExerciseEditorTarget,
} from './exercise-editor-modal';
import { ExerciseFilterModal } from './exercise-filter-modal';
import {
  activeFilterCount,
  DEFAULT_EXERCISE_LIBRARY_FILTERS,
  exerciseSummary,
  filterExercises,
  groupExercises,
  muscleGroupLabel,
  sortExercises,
  type ExerciseLibraryFilters,
  type ExerciseLibraryGroup,
} from './exercise-library-model';

const EMPTY_EXERCISES: MobileTrainingExercise[] = [];
const EMPTY_ROUTINES: MobileTrainingExerciseRoutine[] = [];

function defaultIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `exercise-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mutationErrorMessage(result: MobileApiMutationResult<unknown>): string {
  if (result.status === 'validation' || result.status === 'not_found') return result.message;
  if (result.status === 'conflict') {
    return 'Este intento ya fue usado con otros datos. Modificá el formulario e intentá nuevamente.';
  }
  if (result.status === 'auth_required' || result.status === 'unauthorized') {
    return 'Tu sesión necesita volver a validarse.';
  }
  return 'No pudimos completar la acción. Revisá la conexión e intentá nuevamente.';
}

function ExerciseRows({
  exercises,
  onEdit,
}: {
  exercises: MobileTrainingExercise[];
  onEdit: (exercise: MobileTrainingExercise) => void;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <Surface elevated style={styles.exerciseList}>
      {exercises.map((exercise, index) => {
        const summary = exerciseSummary(exercise);
        return (
          <View key={exercise.id}>
            {index > 0 ? <Separator /> : null}
            <Pressable
              accessibilityLabel={`Editar ${exercise.name}`}
              accessibilityRole="button"
              onPress={() => onEdit(exercise)}
              style={({ pressed }) => [styles.exerciseRow, { opacity: pressed ? 0.65 : 1 }]}
              testID={`exercise-row-${exercise.id}`}
            >
              <View style={styles.exerciseCopy}>
                <View style={styles.exerciseTitleRow}>
                  <AppText numberOfLines={2} testID="exercise-name" variant="label">
                    {exercise.name}
                  </AppText>
                  {!exercise.isActive ? (
                    <View style={[styles.archivedBadge, { backgroundColor: colors.surfaceRaised }]}>
                      <AppText muted variant="footnote">ARCHIVADO</AppText>
                    </View>
                  ) : null}
                </View>
                {summary ? <AppText muted variant="caption">{summary}</AppText> : null}
              </View>
              <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
            </Pressable>
          </View>
        );
      })}
    </Surface>
  );
}

function GroupSection({
  expanded,
  label,
  onToggle,
  exercises,
  onEdit,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  exercises: MobileTrainingExercise[];
  onEdit: (exercise: MobileTrainingExercise) => void;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={styles.groupSection}>
      <Pressable
        accessibilityLabel={`${expanded ? 'Contraer' : 'Expandir'} ${label}, ${exercises.length} ejercicios`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.groupHeader,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={[styles.disclosure, expanded && styles.disclosureExpanded]}>
          <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
        </View>
        <AppText style={styles.groupTitle} variant="footnote">{label.toUpperCase()}</AppText>
        <View style={[styles.countBadge, { backgroundColor: colors.surfaceRaised }]}>
          <AppText variant="caption">{exercises.length}</AppText>
        </View>
      </Pressable>
      {expanded ? <ExerciseRows exercises={exercises} onEdit={onEdit} /> : null}
    </View>
  );
}

function LibrarySkeleton() {
  return (
    <ScrollScreen testID="exercise-library-loading">
      <SkeletonBlock height={48} width="75%" />
      <SkeletonBlock height={48} />
      <SkeletonBlock height={28} width="55%" />
      <SkeletonBlock height={58} />
      <SkeletonBlock height={58} />
      <SkeletonBlock height={58} />
    </ScrollScreen>
  );
}

function FilterSummary({
  filters,
  routineNames,
}: {
  filters: ExerciseLibraryFilters;
  routineNames: Map<string, string>;
}) {
  const { colors } = useOwnlevelTheme();
  const labels = [
    filters.usage === 'assigned' ? 'En rutina' : filters.usage === 'unassigned' ? 'Sin rutina' : null,
    ...filters.routineIds.map((id) => routineNames.get(id) ?? 'Rutina'),
    ...filters.muscleGroups.map((group) => group === 'none' ? 'Sin clasificar' : muscleGroupLabel(group)),
    ...filters.implements,
    filters.status === 'archived' ? 'Archivados' : filters.status === 'all' ? 'Todos' : null,
  ].filter((label): label is string => Boolean(label));
  return labels.length ? (
    <View accessibilityLabel="Filtros activos" style={styles.filterChips}>
      {labels.map((label, index) => (
        <View
          key={`${label}-${index}`}
          style={[styles.filterChip, { backgroundColor: colors.brandSubtle, borderColor: colors.primary }]}
        >
          <AppText style={{ color: colors.primary }} variant="caption">{label}</AppText>
        </View>
      ))}
    </View>
  ) : null;
}

export function ExerciseLibraryScreen({
  createIdempotencyKey = defaultIdempotencyKey,
}: {
  createIdempotencyKey?: () => string;
}) {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ExerciseLibraryFilters>(DEFAULT_EXERCISE_LIBRARY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editor, setEditor] = useState<ExerciseEditorTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<ExerciseLibraryGroup>>(new Set());
  const initializedGroups = useRef(false);

  const load = useCallback(
    (signal: AbortSignal) => {
      if (!client) {
        return Promise.resolve({
          status: 'unavailable' as const,
          reason: 'invalid_response' as const,
          meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const },
        });
      }
      return fetchMobileTrainingExercises(client, signal);
    },
    [client],
  );
  const { refresh, state } = useApiResource(load);
  const current = state.status === 'ready'
    ? state.current
    : state.status === 'loading'
      ? undefined
      : state.previous;
  const catalog = current?.data.catalog.status === 'ok' ? current.data.catalog.data : null;
  const exercises = catalog?.exercises ?? EMPTY_EXERCISES;
  const routines = catalog?.routines ?? EMPTY_ROUTINES;
  const visible = useMemo(
    () => filterExercises(exercises, query, filters),
    [exercises, filters, query],
  );
  const grouped = useMemo(() => groupExercises(visible), [visible]);
  const routineNames = useMemo(
    () => new Map(routines.map((routine) => [routine.id, routine.name])),
    [routines],
  );
  const queryActive = Boolean(query.trim());

  useEffect(() => {
    if (!initializedGroups.current && grouped[0]) {
      initializedGroups.current = true;
      setOpenGroups(new Set([grouped[0].value]));
    }
  }, [grouped]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const announce = useCallback((message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    void AccessibilityInfo.announceForAccessibility(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 3_500);
  }, []);

  const runRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const saveExercise = useCallback(async (
    mutation: MobileTrainingExerciseMutation,
    routineIds: string[],
    idempotencyKey?: string,
  ): Promise<string | null> => {
    if (!client || pending || !editor) return 'Esperá a que termine la acción actual.';
    setPending(true);
    const result = editor.mode === 'create'
      ? await createMobileTrainingExercise(client, {
        exercise: mutation,
        routineIds: routineIds.slice(0, 1) as [] | [string],
        idempotencyKey: idempotencyKey ?? '',
      })
      : await updateMobileTrainingExercise(client, editor.exercise.id, mutation, routineIds);
    if (result.status === 'ok') {
      setEditor(null);
      announce(result.data.warning ?? (editor.mode === 'create' ? 'Ejercicio creado.' : 'Cambios guardados.'));
      await refresh();
      setPending(false);
      return null;
    }
    setPending(false);
    return mutationErrorMessage(result);
  }, [announce, client, editor, pending, refresh]);

  const changeStatus = useCallback((exercise: MobileTrainingExercise) => {
    if (!client || pending) return;
    const restoring = !exercise.isActive;
    const action = restoring ? 'Restaurar' : 'Archivar';
    Alert.alert(
      `${action} ${exercise.name}`,
      'Las sesiones y registros anteriores siempre se conservan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action,
          style: restoring ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setPending(true);
              const result = await setMobileTrainingExerciseStatus(client, exercise.id, restoring);
              if (result.status === 'ok') {
                setEditor(null);
                announce(restoring ? 'Ejercicio restaurado.' : 'Ejercicio archivado.');
                await refresh();
              } else {
                Alert.alert('No pudimos completar la acción', mutationErrorMessage(result));
              }
              setPending(false);
            })();
          },
        },
      ],
    );
  }, [announce, client, pending, refresh]);

  if (!current && state.status === 'loading') return <LibrarySkeleton />;
  if (!current) {
    return (
      <ScrollScreen testID="exercise-library-unavailable">
        <UnavailableState
          action={<Button label="Reintentar" onPress={runRefresh} />}
          description="Tus ejercicios siguen seguros. Revisá la conexión e intentá nuevamente."
          title="No pudimos cargar la Biblioteca"
        />
      </ScrollScreen>
    );
  }

  const statusTitle = filters.status === 'active'
    ? 'Ejercicios activos'
    : filters.status === 'archived'
      ? 'Ejercicios archivados'
      : 'Todos los ejercicios';

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Nuevo ejercicio"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                haptics.selection();
                setEditor({ mode: 'create' });
              }}
            >
              <AppText style={{ color: colors.primary }} variant="label">+ Nuevo</AppText>
            </Pressable>
          ),
          title: 'Biblioteca',
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
        testID="exercise-library-screen"
      >
        <AppText muted>Buscá y organizá tus ejercicios.</AppText>

        {state.status !== 'ready' ? (
          <Surface style={styles.noticeSurface} testID="exercise-library-stale">
            <InlineUnavailable
              actionLabel="Reintentar"
              message="No se pudo actualizar. Mostramos la última lectura confirmada."
              onAction={runRefresh}
            />
          </Surface>
        ) : null}

        {current.data.catalog.status === 'unavailable' ? (
          <UnavailableState
            action={<Button label="Reintentar" onPress={runRefresh} />}
            description="No mostramos una lista vacía porque el catálogo no pudo confirmarse."
            title="Biblioteca no disponible"
          />
        ) : (
          <>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Buscar ejercicio, músculo o implemento"
                onChangeText={setQuery}
                placeholder="Buscar ejercicio, músculo o implemento"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.searchInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                ]}
                value={query}
              />
              <Pressable
                accessibilityLabel={`Filtros${activeFilterCount(filters) ? `, ${activeFilterCount(filters)} activos` : ''}`}
                accessibilityRole="button"
                onPress={() => setFiltersOpen(true)}
                style={({ pressed }) => [
                  styles.filterButton,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <AppIcon color={colors.primary} name="filter" size={20} />
                {activeFilterCount(filters) ? (
                  <AppText style={{ color: colors.primary }} variant="caption">
                    {activeFilterCount(filters)}
                  </AppText>
                ) : null}
              </Pressable>
            </View>
            <FilterSummary filters={filters} routineNames={routineNames} />

            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <AppText muted variant="label">{queryActive ? 'Resultados' : statusTitle}</AppText>
                <AppText muted variant="caption">
                  {visible.length} {visible.length === 1 ? 'ejercicio' : 'ejercicios'}
                </AppText>
              </View>

              {visible.length === 0 ? (
                <EmptyState
                  action={
                    <Button
                      label="Limpiar"
                      onPress={() => {
                        setQuery('');
                        setFilters(DEFAULT_EXERCISE_LIBRARY_FILTERS);
                      }}
                      variant="secondary"
                    />
                  }
                  description={queryActive ? `No encontramos “${query.trim()}”.` : 'No hay ejercicios con estos filtros.'}
                  title="Sin resultados"
                />
              ) : queryActive ? (
                <ExerciseRows exercises={sortExercises(visible)} onEdit={(exercise) => setEditor({ mode: 'edit', exercise })} />
              ) : (
                <View style={styles.groups}>
                  {grouped.map((group) => (
                    <GroupSection
                      expanded={openGroups.has(group.value)}
                      exercises={group.exercises}
                      key={group.value}
                      label={group.label}
                      onEdit={(exercise) => setEditor({ mode: 'edit', exercise })}
                      onToggle={() => setOpenGroups((currentGroups) => {
                        const next = new Set(currentGroups);
                        if (next.has(group.value)) next.delete(group.value);
                        else next.add(group.value);
                        return next;
                      })}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
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

      {filtersOpen && catalog ? (
        <ExerciseFilterModal
          applied={filters}
          exercises={catalog.exercises}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
          query={query}
          routines={catalog.routines}
        />
      ) : null}

      {editor && catalog ? (
        <ExerciseEditorModal
          createIdempotencyKey={createIdempotencyKey}
          onClose={() => setEditor(null)}
          onSave={saveExercise}
          onSetStatus={changeStatus}
          pending={pending}
          routines={catalog.routines}
          target={editor}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  archivedBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countBadge: { borderRadius: radius.pill, minWidth: 30, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  disclosure: { transform: [{ rotate: '0deg' }] },
  disclosureExpanded: { transform: [{ rotate: '90deg' }] },
  exerciseCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  exerciseList: { gap: 0, overflow: 'hidden', padding: 0 },
  exerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exerciseTitleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 48,
    justifyContent: 'center',
    minWidth: 48,
    paddingHorizontal: spacing.sm,
  },
  filterChip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupHeader: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  groupSection: { gap: spacing.xs },
  groupTitle: { flex: 1 },
  groups: { gap: spacing.sm },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  listSection: { gap: spacing.md },
  noticeSurface: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  toastContainer: { alignItems: 'center', left: spacing.lg, position: 'absolute', right: spacing.lg },
  toastSurface: { maxWidth: 520, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, width: '100%' },
});
