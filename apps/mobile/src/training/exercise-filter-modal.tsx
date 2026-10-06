import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  MobileTrainingExercise,
  MobileTrainingExerciseRoutine,
} from '@/api/exercises';
import {
  AppIcon,
  AppText,
  Button,
  Heading,
  Surface,
  radius,
  sizes,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';

import {
  cloneFilters,
  DEFAULT_EXERCISE_LIBRARY_FILTERS,
  filterExercises,
  type ExerciseLibraryFilters,
  implementOptions,
  MUSCLE_GROUP_OPTIONS,
  toggleValue,
} from './exercise-library-model';
import { trainingRoutineColor } from './routine-colors';

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionCopy}>
        <AppText variant="label">{title}</AppText>
        {description ? <AppText muted variant="caption">{description}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  value: T;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: selected ? colors.brandSubtle : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText style={selected ? { color: colors.primary } : undefined} variant="caption">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Selectable({
  label,
  onPress,
  selected,
  dotColor,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  dotColor?: string;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityLabel="Sin clasificar"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectable,
        {
          backgroundColor: selected ? colors.brandSubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <AppText numberOfLines={2} style={styles.selectableLabel} variant="caption">{label}</AppText>
      <View
        style={[
          styles.selectionIndicator,
          { borderColor: selected ? colors.primary : colors.border },
        ]}
      >
        {selected ? <AppIcon color={colors.primary} name="check" size={17} /> : null}
      </View>
    </Pressable>
  );
}

function UnclassifiedSelectable({
  onPress,
  selected,
}: {
  onPress: () => void;
  selected: boolean;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.unclassifiedSelectable,
        {
          backgroundColor: selected ? colors.brandSubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      testID="unclassified-filter-row"
    >
      <View style={styles.unclassifiedCopy}>
        <AppText variant="label">Sin clasificar</AppText>
        <AppText muted variant="caption">
          Mostrar ejercicios sin grupo muscular asignado.
        </AppText>
      </View>
      <View
        style={[
          styles.selectionIndicator,
          { borderColor: selected ? colors.primary : colors.border },
        ]}
      >
        {selected ? <AppIcon color={colors.primary} name="check" size={17} /> : null}
      </View>
    </Pressable>
  );
}

export function ExerciseFilterModal({
  applied,
  exercises,
  onApply,
  onClose,
  query,
  routines,
}: {
  applied: ExerciseLibraryFilters;
  exercises: MobileTrainingExercise[];
  onApply: (filters: ExerciseLibraryFilters) => void;
  onClose: () => void;
  query: string;
  routines: MobileTrainingExerciseRoutine[];
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const [draft, setDraft] = useState(() => cloneFilters(applied));
  const [implementsOpen, setImplementsOpen] = useState(false);
  const availableImplements = useMemo(() => implementOptions(exercises), [exercises]);
  const previewCount = useMemo(
    () => filterExercises(exercises, query, draft).length,
    [draft, exercises, query],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Limpiar filtros"
            accessibilityRole="button"
            onPress={() => setDraft(cloneFilters(DEFAULT_EXERCISE_LIBRARY_FILTERS))}
            style={styles.headerAction}
          >
            <AppText style={{ color: colors.primary }} variant="label">Limpiar</AppText>
          </Pressable>
          <View style={styles.headerCopy}>
            <Heading level={2}>Filtrar ejercicios</Heading>
            <AppText muted variant="caption">
              Acotá la biblioteca por rutina, músculo e implemento.
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Cerrar filtros sin aplicar"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <AppText style={styles.closeLabel}>×</AppText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Section
            description="Filtrá por ejercicios que estén o no en tus rutinas."
            title="Uso en rutinas"
          >
            <Segmented
              label="Uso en rutinas"
              onChange={(usage) => setDraft({ ...draft, usage, routineIds: [] })}
              options={[
                { value: 'any', label: 'Cualquiera' },
                { value: 'assigned', label: 'En rutina' },
                { value: 'unassigned', label: 'Sin rutina' },
              ]}
              value={draft.usage}
            />
            {draft.usage === 'assigned' ? (
              <View style={styles.grid}>
                {routines.map((routine) => (
                  <Selectable
                    dotColor={routine.color ? trainingRoutineColor(routine.color, isDark) : colors.textMuted}
                    key={routine.id}
                    label={routine.name}
                    onPress={() => setDraft({
                      ...draft,
                      routineIds: toggleValue(draft.routineIds, routine.id),
                    })}
                    selected={draft.routineIds.includes(routine.id)}
                  />
                ))}
                {routines.length === 0 ? (
                  <AppText muted variant="caption">No hay rutinas activas.</AppText>
                ) : null}
              </View>
            ) : null}
          </Section>

          <Section
            description="Seleccioná uno o más grupos musculares."
            title="Grupo muscular"
          >
            <View style={styles.grid}>
              {MUSCLE_GROUP_OPTIONS.map((group) => (
                <Selectable
                  key={group.value}
                  label={group.label}
                  onPress={() => setDraft({
                    ...draft,
                    muscleGroups: toggleValue(draft.muscleGroups, group.value),
                  })}
                  selected={draft.muscleGroups.includes(group.value)}
                />
              ))}
            </View>
            <UnclassifiedSelectable
              onPress={() => setDraft({
                ...draft,
                muscleGroups: toggleValue(draft.muscleGroups, 'none'),
              })}
              selected={draft.muscleGroups.includes('none')}
            />
          </Section>

          <Section title="Implemento">
            <Pressable
              accessibilityLabel={`Implemento: ${draft.implements.length === 0 ? 'Todos' : `${draft.implements.length} seleccionados`}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: implementsOpen }}
              onPress={() => setImplementsOpen((value) => !value)}
              style={({ pressed }) => [
                styles.implementRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.headerCopy}>
                <AppText variant="label">Implemento</AppText>
                <AppText muted variant="caption">Filtrá por tipo de implemento.</AppText>
              </View>
              <AppText muted variant="caption">
                {draft.implements.length === 0
                  ? 'Todos'
                  : draft.implements.length === 1
                    ? draft.implements[0]
                    : `${draft.implements.length} seleccionados`}
              </AppText>
            </Pressable>
            {implementsOpen ? (
              <View style={styles.optionStack}>
                {availableImplements.map((item) => (
                  <Selectable
                    key={item}
                    label={item}
                    onPress={() => setDraft({
                      ...draft,
                      implements: toggleValue(draft.implements, item),
                    })}
                    selected={draft.implements.includes(item)}
                  />
                ))}
                {availableImplements.length === 0 ? (
                  <AppText muted variant="caption">No hay implementos disponibles.</AppText>
                ) : null}
              </View>
            ) : null}
          </Section>

          <Section description="Filtrá por estado del ejercicio." title="Mostrar">
            <Segmented
              label="Estado del ejercicio"
              onChange={(status) => setDraft({ ...draft, status })}
              options={[
                { value: 'active', label: 'Activos' },
                { value: 'archived', label: 'Archivados' },
                { value: 'all', label: 'Todos' },
              ]}
              value={draft.status}
            />
          </Section>
        </ScrollView>

        <Surface style={styles.footer}>
          <AppText muted variant="caption">
            {previewCount} {previewCount === 1 ? 'ejercicio' : 'ejercicios'}
          </AppText>
          <View style={styles.footerButton}>
            <Button label="Ver ejercicios" onPress={() => onApply(cloneFilters(draft))} />
          </View>
        </Surface>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    height: sizes.touchTarget,
    justifyContent: 'center',
    width: sizes.touchTarget,
  },
  closeLabel: { fontSize: 28, fontWeight: '300', lineHeight: 30 },
  content: { gap: spacing.xl, padding: spacing.lg },
  dot: { borderRadius: radius.pill, height: 9, width: 9 },
  footer: {
    alignItems: 'center',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRadius: 0,
    borderRightWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerButton: { minWidth: 150 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerAction: {
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    minWidth: 58,
  },
  headerCopy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  implementRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
  },
  optionStack: { gap: spacing.sm },
  screen: { flex: 1 },
  section: { gap: spacing.md },
  sectionCopy: { gap: spacing.xs },
  selectionIndicator: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.xs,
  },
  segmented: { flexDirection: 'row', gap: spacing.xs },
  selectable: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    width: '48.5%',
  },
  selectableLabel: { flex: 1 },
  unclassifiedCopy: { flex: 1, gap: spacing.xs },
  unclassifiedSelectable: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
    width: '100%',
  },
});
