import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, RefreshControl } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MobileTrainingExercisesResponse } from '@/api/exercises';
import { OwnlevelThemeProvider } from '@/design-system';

import { ExerciseLibraryScreen } from './exercise-library-screen';

const mockCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetch = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefresh = jest.fn<() => Promise<void>>();
const mockSetStatus = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUseApiResource = jest.fn();

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => React.ReactNode } }) =>
      options.headerRight?.() ?? null,
  },
}));
jest.mock('@/api', () => ({
  createMobileTrainingExercise: (...args: unknown[]) => mockCreate(...args),
  fetchMobileTrainingExercises: (...args: unknown[]) => mockFetch(...args),
  setMobileTrainingExerciseStatus: (...args: unknown[]) => mockSetStatus(...args),
  updateMobileTrainingExercise: (...args: unknown[]) => mockUpdate(...args),
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
  useMobileApi: () => ({ client: { request: jest.fn() } }),
}));
jest.mock('@/platform/haptics', () => ({ haptics: { selection: jest.fn() } }));

const pushId = '11111111-1111-4111-8111-111111111111';
const pullId = '22222222-2222-4222-8222-222222222222';
const pressId = '33333333-3333-4333-8333-333333333333';
const curlId = '44444444-4444-4444-8444-444444444444';

const press = {
  id: pressId,
  name: 'Press inclinado',
  muscleGroup: 'pecho' as const,
  muscleGroupLabel: 'Pectoral mayor',
  implement: 'Mancuernas',
  weightMode: 'Por mancuerna',
  suggestedSets: 3,
  suggestedReps: 10,
  suggestedWeight: 22.5,
  suggestedRir: 2,
  suggestedRestMinSeconds: 90,
  suggestedRestMaxSeconds: 120,
  notes: 'Controlado',
  isActive: true,
  routineIds: [pushId],
  updatedAt: '2026-09-28T12:00:00.000Z',
};
const curl = {
  ...press,
  id: curlId,
  name: 'Curl bíceps',
  muscleGroup: 'bíceps' as const,
  muscleGroupLabel: null,
  implement: 'Polea',
  weightMode: 'Peso total',
  isActive: false,
  routineIds: [pullId],
};
const routines = [
  { id: pushId, name: 'PUSH', color: 'violet' as const },
  { id: pullId, name: 'PULL', color: 'blue' as const },
];

function fixture(overrides: Partial<MobileTrainingExercisesResponse> = {}): MobileTrainingExercisesResponse {
  return {
    catalog: { status: 'ok', data: { exercises: [press, curl], routines } },
    ...overrides,
  };
}

function readyState(data = fixture()) {
  return {
    status: 'ready' as const,
    current: { confirmedAt: 1, data },
    refreshing: false,
    trigger: 'initial' as const,
    result: {
      status: 'ok' as const,
      data,
      meta: { durationMs: 10, httpStatus: 200, outcome: 'ok' as const },
    },
  };
}

function renderScreen(createIdempotencyKey = jest.fn(() => 'exercise-key')) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 844, width: 390, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 47 },
      }}
    >
      <OwnlevelThemeProvider initialMode="light">
        <ExerciseLibraryScreen createIdempotencyKey={createIdempotencyKey} />
      </OwnlevelThemeProvider>
    </SafeAreaProvider>,
  );
}

function confirmLastAlert() {
  const call = jest.mocked(Alert.alert).mock.calls.at(-1);
  const buttons = call?.[2];
  const confirm = Array.isArray(buttons) ? buttons.at(-1) : undefined;
  act(() => confirm?.onPress?.());
}

describe('native exercise library', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCreate.mockReset();
    mockFetch.mockReset();
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    mockSetStatus.mockReset();
    mockUpdate.mockReset();
    mockUseApiResource.mockReset();
  });

  it('renders loading, catalog unavailable and valid empty distinctly', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: { status: 'loading', trigger: 'initial' } });
    const loading = renderScreen();
    expect(loading.getByTestId('exercise-library-loading')).toBeTruthy();
    loading.unmount();

    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: readyState(fixture({ catalog: { status: 'unavailable' } })),
    });
    const unavailable = renderScreen();
    expect(unavailable.getByText('Biblioteca no disponible')).toBeTruthy();
    expect(unavailable.queryByText('0 ejercicios')).toBeNull();
    unavailable.unmount();

    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: readyState(fixture({ catalog: { status: 'ok', data: { exercises: [], routines } } })),
    });
    expect(renderScreen().getByText('Sin resultados')).toBeTruthy();
  });

  it('groups the active catalog and searches locally as a flat alphabetical list', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    await waitFor(() => expect(view.getByText('PECHO')).toBeTruthy());
    expect(view.getByText('Press inclinado')).toBeTruthy();
    expect(view.queryByText('Curl bíceps')).toBeNull();

    fireEvent.changeText(view.getByLabelText('Buscar ejercicio, músculo o implemento'), 'mancuernas');
    expect(view.getByText('Resultados')).toBeTruthy();
    expect(view.getByText('Press inclinado')).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows the initially open group to remain collapsed', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    const group = await view.findByRole('button', { name: 'Contraer Pecho, 1 ejercicios' });
    fireEvent.press(group);
    await waitFor(() => expect(view.queryByText('Press inclinado')).toBeNull());
  });

  it('keeps filter draft isolated until apply and shows preview count', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Filtros' }));
    fireEvent.press(view.getByRole('radio', { name: 'Archivados' }));
    expect(view.getAllByText('1 ejercicio')).toHaveLength(2);
    fireEvent.press(view.getByRole('button', { name: 'Cerrar filtros sin aplicar' }));
    expect(view.getByText('Ejercicios activos')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Filtros' }));
    fireEvent.press(view.getByRole('radio', { name: 'Archivados' }));
    fireEvent.press(view.getByRole('button', { name: 'Ver ejercicios' }));
    await waitFor(() => expect(view.getByText('Ejercicios archivados')).toBeTruthy());
    expect(view.getByText('BÍCEPS')).toBeTruthy();
  });

  it('clears filter draft without changing applied filters before apply', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Filtros' }));
    fireEvent.press(view.getByRole('radio', { name: 'Sin rutina' }));
    fireEvent.press(view.getByRole('button', { name: 'Limpiar filtros' }));
    fireEvent.press(view.getByRole('button', { name: 'Cerrar filtros sin aplicar' }));
    expect(view.getByText('Ejercicios activos')).toBeTruthy();
  });

  it('renders the unclassified filter as a described full-width selectable row', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Filtros' }));

    const row = view.getByTestId('unclassified-filter-row');
    expect(row.props.accessibilityState).toEqual({ checked: false });
    expect(row.props.accessibilityLabel).toBe('Sin clasificar');
    // Every other filter option announces its own name, never "Sin clasificar".
    const checkboxes = view.getAllByRole('checkbox').filter(box => box.props.testID !== 'unclassified-filter-row');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const box of checkboxes) expect(box.props.accessibilityLabel).not.toBe('Sin clasificar');
    expect(checkboxes.every(box => typeof box.props.accessibilityLabel === 'string' && box.props.accessibilityLabel.length > 0)).toBe(true);
    expect(view.getByText('Mostrar ejercicios sin grupo muscular asignado.')).toBeTruthy();
    fireEvent.press(row);
    expect(view.getByTestId('unclassified-filter-row').props.accessibilityState).toEqual({
      checked: true,
    });
  });

  it('creates with zero or one routine and reports a partial warning', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockCreate.mockResolvedValue({
      status: 'ok',
      data: { exercise: press, warning: 'Ejercicio creado. No pudo agregarse a la rutina.' },
    });
    const keyFactory = jest.fn(() => 'stable-key');
    const view = renderScreen(keyFactory);

    fireEvent.press(view.getByRole('button', { name: 'Nuevo ejercicio' }));
    fireEvent.press(view.getByRole('button', { name: 'Crear ejercicio' }));
    expect(view.getByText('Nombre es obligatorio.')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Nombre'), 'Press nuevo');
    fireEvent.press(view.getByRole('radio', { name: 'PUSH' }));
    fireEvent.press(view.getByRole('button', { name: 'Crear ejercicio' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
      routineIds: [pushId],
      idempotencyKey: 'stable-key',
    });
    expect(view.getByText(/No pudo agregarse a la rutina/)).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('reuses create key after ambiguous failure and prevents duplicate pending submit', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    let resolveFirst: ((value: unknown) => void) | undefined;
    mockCreate.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const keyFactory = jest.fn(() => 'same-key');
    const view = renderScreen(keyFactory);

    fireEvent.press(view.getByRole('button', { name: 'Nuevo ejercicio' }));
    fireEvent.changeText(view.getByLabelText('Nombre'), 'Press nuevo');
    fireEvent.press(view.getByRole('button', { name: 'Crear ejercicio' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Creando…' })).toBeDisabled());
    fireEvent.press(view.getByRole('button', { name: 'Creando…' }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => resolveFirst?.({ status: 'unavailable', reason: 'network' }));
    expect(view.getByText(/No pudimos completar/)).toBeTruthy();

    mockCreate.mockResolvedValueOnce({ status: 'ok', data: { exercise: press } });
    fireEvent.press(view.getByRole('button', { name: 'Crear ejercicio' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    expect((mockCreate.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey).toBe('same-key');
    expect((mockCreate.mock.calls[1]?.[1] as { idempotencyKey: string }).idempotencyKey).toBe('same-key');
    expect(keyFactory).toHaveBeenCalledTimes(1);
  });

  it('uses a new idempotency key for a new intentional create', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockCreate.mockResolvedValue({ status: 'ok', data: { exercise: press } });
    const keyFactory = jest.fn<() => string>()
      .mockReturnValueOnce('key-one')
      .mockReturnValueOnce('key-two');
    const view = renderScreen(keyFactory);

    fireEvent.press(view.getByRole('button', { name: 'Nuevo ejercicio' }));
    fireEvent.changeText(view.getByLabelText('Nombre'), 'Primero');
    fireEvent.press(view.getByRole('button', { name: 'Crear ejercicio' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    fireEvent.press(view.getByRole('button', { name: 'Nuevo ejercicio' }));
    fireEvent.changeText(view.getByLabelText('Nombre'), 'Segundo');
    fireEvent.press(view.getByRole('button', { name: 'Crear ejercicio' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));

    expect(mockCreate.mock.calls.map((call) => (
      call[1] as { idempotencyKey: string }
    ).idempotencyKey)).toEqual(['key-one', 'key-two']);
  });

  it('prepopulates edit and sends desired-state memberships atomically', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockUpdate.mockResolvedValue({ status: 'ok', data: { exercise: press } });
    const view = renderScreen();
    await waitFor(() => expect(view.getByText('Press inclinado')).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Editar Press inclinado' }));

    expect(view.getByDisplayValue('Press inclinado')).toBeTruthy();
    expect(view.getByDisplayValue('1:30')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Grupo muscular: Pecho' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Implemento: Mancuernas' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Registro de carga: Por mancuerna' })).toBeTruthy();
    fireEvent.press(view.getByRole('checkbox', { name: 'PULL' }));
    fireEvent.press(view.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      pressId,
      expect.objectContaining({ name: 'Press inclinado' }),
      [pushId, pullId],
    ));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('opens a compact taxonomy selector and can close it without changing the value', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    await waitFor(() => expect(view.getByText('Press inclinado')).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Editar Press inclinado' }));

    fireEvent.press(view.getByRole('button', { name: 'Implemento: Mancuernas' }));
    expect(view.getByTestId('taxonomy-picker')).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Mancuernas' }).props.accessibilityState).toEqual({
      checked: true,
    });
    fireEvent.press(view.getByRole('button', { name: 'Cerrar selector sin cambiar' }));

    expect(view.getByRole('button', { name: 'Implemento: Mancuernas' })).toBeTruthy();
    expect(view.queryByTestId('taxonomy-picker')).toBeNull();
  });

  it('keeps confirmed edit open with an error when update fails', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockUpdate.mockResolvedValue({ status: 'unavailable', reason: 'server' });
    const view = renderScreen();
    await waitFor(() => expect(view.getByText('Press inclinado')).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Editar Press inclinado' }));
    fireEvent.changeText(view.getByLabelText('Nombre'), 'Press actualizado');
    fireEvent.press(view.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(view.getByText(/No pudimos completar la acción/)).toBeTruthy());
    expect(view.getByDisplayValue('Press actualizado')).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('archives and restores only after native confirmation', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockSetStatus.mockResolvedValue({ status: 'ok', data: {} });
    const view = renderScreen();
    await waitFor(() => expect(view.getByText('Press inclinado')).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Editar Press inclinado' }));
    fireEvent.press(view.getByRole('button', { name: 'Archivar ejercicio' }));
    expect(mockSetStatus).not.toHaveBeenCalled();
    confirmLastAlert();
    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith(expect.anything(), pressId, false));
    view.unmount();

    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: readyState(fixture({
        catalog: { status: 'ok', data: { exercises: [{ ...curl, isActive: false }], routines } },
      })),
    });
    const archivedView = renderScreen();
    fireEvent.press(archivedView.getByRole('button', { name: 'Filtros' }));
    fireEvent.press(archivedView.getByRole('radio', { name: 'Archivados' }));
    fireEvent.press(archivedView.getByRole('button', { name: 'Ver ejercicios' }));
    await waitFor(() => expect(archivedView.getByText('Curl bíceps')).toBeTruthy());
    fireEvent.press(archivedView.getByRole('button', { name: 'Editar Curl bíceps' }));
    fireEvent.press(archivedView.getByRole('button', { name: 'Restaurar ejercicio' }));
    confirmLastAlert();
    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith(expect.anything(), curlId, true));
  });

  it('preserves stale data and supports pull-to-refresh', () => {
    const data = fixture();
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'unavailable',
        previous: { confirmedAt: 1, data },
        reason: 'network',
        result: {
          status: 'unavailable',
          reason: 'network',
          meta: { durationMs: 10, httpStatus: null, outcome: 'unavailable' },
        },
      },
    });
    const view = renderScreen();
    expect(view.getByTestId('exercise-library-stale')).toBeTruthy();
    fireEvent(view.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
