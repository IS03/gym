import { fireEvent, render, within } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { parseProgressBody, parseProgressTraining, type ProgressBody, type ProgressTraining } from '@/api/progress';
import { OwnlevelThemeProvider } from '@/design-system';

import { HomeProgress } from './home-progress';
import type { HomeResource } from './home-resource';
import { homeProgressBody, homeProgressTraining } from './home-test-fixtures';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const ready = <T,>(data: T): HomeResource<T> => ({ data, confirmedAt: 1, status: 'ready' });
const unavailable = <T,>(data?: T): HomeResource<T> => ({ data, confirmedAt: data ? 1 : null, status: 'unavailable' });
const loading = <T,>(): HomeResource<T> => ({ data: undefined, confirmedAt: null, status: 'loading' });

function show(overrides: Partial<React.ComponentProps<typeof HomeProgress>> = {}) {
  const onOpen = jest.fn(), onRetry = jest.fn(), onAll = jest.fn();
  const props = { body: ready(homeProgressBody()), date: '2026-10-10', training: ready(homeProgressTraining()),
    records: ready(homeProgressTraining('30')), onOpen, onRetry, onAll, ...overrides };
  return { ...render(<OwnlevelThemeProvider initialMode="light"><HomeProgress {...props} /></OwnlevelThemeProvider>), onOpen, onRetry, onAll };
}

describe('Home progress', () => {
  it('uses contract-valid snapshots and shows server variation, equivalent-period comparison and true records', () => {
    expect(parseProgressBody(homeProgressBody())).toBeDefined();
    expect(parseProgressTraining(homeProgressTraining())).toBeDefined();
    expect(parseProgressTraining(homeProgressTraining('30'))).toBeDefined();
    const view = show();
    expect(view.getByText('78,4 kg')).toBeTruthy();
    expect(view.getByText(/↓ −0,3 kg entre registros/)).toBeTruthy();
    expect(view.getByText(/↑ \+1 entrenamiento vs\. los 7 días anteriores/)).toBeTruthy();
    expect(view.getByText('Últimos 30 días · Press banca')).toBeTruthy();
    expect(view.queryByText(/volumen|mejor peso corporal/i)).toBeNull();
  });

  it('keeps the period and routes multiple PRs to the training list', () => {
    const records = homeProgressTraining('30');
    records.personalRecords.push({ exerciseId: 'squat-id', name: 'Sentadilla', description: 'Nuevo mejor peso: 100 kg × 5' });
    const view = show({ records: ready(records) });
    fireEvent.press(within(view.getByTestId('home-progress-weight')).getByRole('button'));
    fireEvent.press(within(view.getByTestId('home-progress-training')).getByRole('button'));
    fireEvent.press(within(view.getByTestId('home-progress-records')).getByRole('button'));
    expect(view.onOpen.mock.calls).toEqual([[{ kind: 'body', period: '7' }], [{ kind: 'training', period: '7' }], [{ kind: 'training', period: '30' }]]);
  });

  it('one weight observation does not invent a variation; zero workouts is a real zero without a fabricated percentage', () => {
    const body = homeProgressBody();
    Object.assign(body.metrics[0], { first: body.metrics[0].latest, observations: [body.metrics[0].latest], change: null, trend: 'unavailable' });
    const training = homeProgressTraining();
    training.summary.sessions = 0;
    training.summary.comparisons.sessions = { status: 'insufficient_data', reason: 'previous_period_empty', current: 0, previous: null,
      deltaAbsolute: null, deltaPercent: null, change: 'insufficient_data' };
    const view = show({ body: ready(body), training: ready(training) });
    expect(view.getByText(/Faltan registros para comparar/)).toBeTruthy();
    expect(within(view.getByTestId('home-progress-training')).getByText('0')).toBeTruthy();
    expect(view.getByText(/Sin comparación: el período anterior no tiene datos/)).toBeTruthy();
    expect(view.queryByText(/%/)).toBeNull();
  });

  it.each(['improved', 'declined'] as const)('without a PR shows a real %s exercise signal with its native units and context', status => {
    const records = homeProgressTraining('30'); records.personalRecords = [];
    records.exercises = [{ id: 'machine-id', name: 'Remo', muscleLabel: 'Espalda', weightMode: 'unit_reps', status, reason: 'comparable',
      signal: { kind: 'load', description: '8 lingotes × 6 reps', currentValue: 8, referenceValue: 7, contextValue: 6 },
      isPersonalRecord: false, sessions: 3, sets: 9, lastDate: '2026-10-09' }];
    const view = show({ records: ready(records) });
    expect(view.getByText(`Últimos 30 días · ${status === 'improved' ? '↑' : '↓'} Remo · 8 lingotes × 6 reps`)).toBeTruthy();
    fireEvent.press(within(view.getByTestId('home-progress-records')).getByRole('button'));
    expect(view.onOpen).toHaveBeenCalledWith({ kind: 'exercise', period: '30', exerciseId: 'machine-id' });
  });

  it('empty data and incomparable exercises stay neutral without fake records', () => {
    const body = homeProgressBody(); body.metrics = [];
    const records = homeProgressTraining('30'); records.personalRecords = [];
    records.summary.performance.comparable = 0;
    const view = show({ body: ready(body), records: ready(records) });
    expect(view.getByText('Todavía no tenés un peso registrado')).toBeTruthy();
    expect(view.getByText(/Todavía faltan entrenamientos comparables/)).toBeTruthy();
  });

  it('each read is independent: unavailable weight can retry while training and PRs render', () => {
    const view = show({ body: unavailable<ProgressBody>() });
    expect(view.queryByText('78,4 kg')).toBeNull();
    expect(view.getByText('Últimos 30 días · Press banca')).toBeTruthy();
    fireEvent.press(within(view.getByTestId('home-progress-weight')).getByRole('button', { name: 'Reintentar' }));
    expect(view.onRetry).toHaveBeenCalledTimes(1);
  });

  it('initial reads show placeholders; failed refreshes identify the retained snapshot', () => {
    const view = show({ body: loading<ProgressBody>(), training: unavailable(homeProgressTraining()), records: loading<ProgressTraining>() });
    expect(view.queryByText('78,4 kg')).toBeNull();
    expect(view.queryByText('Últimos 30 días · Press banca')).toBeNull();
    expect(view.getByText(/Última lectura; no se pudo actualizar/)).toBeTruthy();
  });

  it('never shows yesterday\'s rolling-period values as today\'s', () => {
    const view = show({ date: '2026-10-11' });
    expect(view.queryByText('78,4 kg')).toBeNull();
    expect(view.queryByText('Últimos 30 días · Press banca')).toBeNull();
  });
});
