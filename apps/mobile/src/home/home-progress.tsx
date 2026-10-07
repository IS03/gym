import { StyleSheet, View } from 'react-native';

import type { ProgressBody, ProgressTraining, ProgressTrainingExercise } from '@/api/progress';
import { AppText, InlineUnavailable, ListGroup, ListRow, SectionHeader, SkeletonBlock, spacing } from '@/design-system';
import { displayNutritionDate } from '@/nutrition/day-format';
import { comparisonText, formatDelta, formatValue } from '@/progress/progress-format';

import { formatInteger } from './format';
import type { HomeResource } from './home-resource';

export type HomeProgressTarget = { kind: 'body'; period: '7' } | { kind: 'training'; period: '7' | '30' }
  | { kind: 'exercise'; period: '30'; exerciseId: string };

type ProgressRowData = { title: string; detail: string; value?: string; target: HomeProgressTarget };

function ReadRow<T extends { today: string }>({ date, label, onOpen, onRetry, render, resource, testID }: {
  date: string; label: string; onOpen: (target: HomeProgressTarget) => void; onRetry: () => void;
  render: (data: T) => ProgressRowData; resource: HomeResource<T>; testID: string;
}) {
  // A previous day's snapshot must not masquerade as today's rolling period.
  const data = resource.data?.today === date ? resource.data : undefined;
  if (!data) {
    return <View style={styles.state} testID={testID}>
      <AppText variant="headline">{label}</AppText>
      {resource.status === 'loading' || (resource.status === 'ready' && resource.data)
        ? <SkeletonBlock height={18} width="70%" />
        : <InlineUnavailable actionLabel="Reintentar" message="No pudimos cargar estos datos." onAction={onRetry} />}
    </View>;
  }
  const row = render(data);
  const detail = resource.status === 'unavailable' ? `${row.detail} · Última lectura; no se pudo actualizar.` : row.detail;
  return <View testID={testID}>
    <ListRow accessibilityLabel={`${row.title}. ${detail}${row.value ? `. ${row.value}` : ''}`}
      accessibilityHint="Abre el detalle de este período" numericValue onPress={() => onOpen(row.target)}
      subtitle={detail} title={row.title} value={row.value} />
    {resource.status === 'unavailable' ? <InlineUnavailable actionLabel="Reintentar" message="No pudimos actualizar." onAction={onRetry} /> : null}
  </View>;
}

function weightRow(data: ProgressBody): ProgressRowData {
  const weight = data.metrics.find(metric => metric.key === 'body.weight');
  const latest = weight?.latest;
  const variation = weight?.change !== null && weight?.change !== undefined && weight.observations.length >= 2
    ? `${weight.change > 0 ? '↑ ' : weight.change < 0 ? '↓ ' : ''}${formatDelta(weight.change, 'kg')} entre registros · últimos 7 días`
    : 'Faltan registros para comparar los últimos 7 días';
  return {
    title: 'Peso', value: latest ? formatValue(latest.value, 'kg') : undefined,
    detail: latest ? `${variation}${latest.date === data.today ? '' : ` · Registro del ${displayNutritionDate(latest.date)}`}`
      : data.excludedSuspect > 0 ? 'Hay registros excluidos del análisis; revisalos en Cuerpo' : 'Todavía no tenés un peso registrado',
    target: { kind: 'body', period: '7' },
  };
}

function trainingRow(data: ProgressTraining): ProgressRowData {
  const comparison = data.summary.comparisons.sessions;
  const direction = comparison.status === 'comparable' && comparison.deltaAbsolute !== null
    ? comparison.deltaAbsolute > 0 ? '↑ ' : comparison.deltaAbsolute < 0 ? '↓ ' : '' : '';
  const detail = comparison.status === 'comparable' && comparison.deltaAbsolute !== null
    ? comparison.deltaAbsolute === 0 ? 'Sin cambios frente a los 7 días anteriores'
      : `${direction}${formatDelta(comparison.deltaAbsolute, Math.abs(comparison.deltaAbsolute) === 1 ? 'entrenamiento' : 'entrenamientos', 'integer')} vs. los 7 días anteriores`
    : comparisonText(comparison, 'entrenamientos', 'integer');
  return {
    title: 'Entrenamientos', value: formatInteger(data.summary.sessions),
    detail: `Últimos 7 días · ${detail}`,
    target: { kind: 'training', period: '7' },
  };
}

function exerciseChange(exercise: ProgressTrainingExercise): string {
  const direction = exercise.status === 'improved' ? '↑' : '↓';
  return `${direction} ${exercise.name} · ${exercise.signal!.description}`;
}

function recordsRow(data: ProgressTraining): ProgressRowData {
  if (data.personalRecords.length) return {
    title: 'Récords', value: formatInteger(data.personalRecords.length),
    detail: `Últimos 30 días · ${data.personalRecords.slice(0, 2).map(record => record.name).join(' · ')}${data.personalRecords.length > 2 ? '…' : ''}`,
    target: data.personalRecords.length === 1
      ? { kind: 'exercise', period: '30', exerciseId: data.personalRecords[0].exerciseId }
      : { kind: 'training', period: '30' },
  };
  // Use M7's mode-aware assessment; a load increase alone is not a new PR.
  const change = data.exercises.filter(exercise => exercise.signal && (exercise.status === 'improved' || exercise.status === 'declined'))
    .sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))[0];
  if (change) return {
    title: 'Rendimiento', detail: `Últimos 30 días · ${exerciseChange(change)}`,
    target: { kind: 'exercise', period: '30', exerciseId: change.id },
  };
  return {
    title: 'Récords y rendimiento',
    detail: data.summary.performance.comparable > 0
      ? 'Últimos 30 días · Sin nuevos récords ni cambios destacados'
      : 'Todavía faltan entrenamientos comparables · últimos 30 días',
    target: { kind: 'training', period: '30' },
  };
}

export function HomeProgress({ body, date, onAll, onOpen, onRetry, records, training }: {
  body: HomeResource<ProgressBody>; date: string; onAll: () => void; onOpen: (target: HomeProgressTarget) => void;
  onRetry: () => void; records: HomeResource<ProgressTraining>; training: HomeResource<ProgressTraining>;
}) {
  return <View style={styles.section} testID="home-progress">
    <SectionHeader actionLabel="Ver todo" onAction={onAll} title="Progreso" />
    <ListGroup>
      <ReadRow date={date} label="Peso" onOpen={onOpen} onRetry={onRetry} render={weightRow} resource={body} testID="home-progress-weight" />
      <ReadRow date={date} label="Entrenamientos" onOpen={onOpen} onRetry={onRetry} render={trainingRow} resource={training} testID="home-progress-training" />
      <ReadRow date={date} label="Récords y rendimiento" onOpen={onOpen} onRetry={onRetry} render={recordsRow} resource={records} testID="home-progress-records" />
    </ListGroup>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  state: { gap: spacing.sm, paddingVertical: spacing.md },
});
