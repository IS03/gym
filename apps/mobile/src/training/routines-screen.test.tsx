import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, RefreshControl } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MobileTrainingRoutinesResponse } from '@/api/routines';
import { OwnlevelThemeProvider } from '@/design-system';

import { RoutinesScreen } from './routines-screen';

const mockCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetch = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockImport = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefresh = jest.fn<() => Promise<void>>();
const mockSetStatus = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUseApiResource = jest.fn();

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => React.ReactNode } }) =>
      options.headerRight?.() ?? null,
  },
}));
jest.mock('@/api', () => ({
  createMobileTrainingRoutine: (...args: unknown[]) => mockCreate(...args),
  fetchMobileTrainingRoutines: (...args: unknown[]) => mockFetch(...args),
  importMobileTrainingInitialPlan: (...args: unknown[]) => mockImport(...args),
  setMobileTrainingRoutineStatus: (...args: unknown[]) => mockSetStatus(...args),
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
  useMobileApi: () => ({ client: { request: jest.fn() } }),
}));
jest.mock('@/platform/haptics', () => ({
  haptics: { selection: jest.fn() },
}));

const routines = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'LEGS',
    color: 'green' as const,
    order: 2,
    isActive: true,
    exerciseCount: 6,
    setCount: 18,
  },
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'PUSH',
    color: 'violet' as const,
    order: 1,
    isActive: true,
    exerciseCount: 7,
    setCount: 21,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'OLD',
    color: 'orange' as const,
    order: 3,
    isActive: false,
    exerciseCount: 3,
    setCount: 9,
  },
];

function fixture(overrides: Partial<MobileTrainingRoutinesResponse> = {}): MobileTrainingRoutinesResponse {
  return {
    routines: { status: 'ok', data: routines },
    initialPlan: { status: 'ok', data: { imported: true, routinesFound: 3 } },
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
      meta: { durationMs: 12, httpStatus: 200, outcome: 'ok' as const },
    },
  };
}

function renderScreen(createIdempotencyKey = jest.fn(() => 'key-1')) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 844, width: 390, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 47 },
      }}
    >
      <OwnlevelThemeProvider initialMode="light">
        <RoutinesScreen createIdempotencyKey={createIdempotencyKey} />
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

describe('native Training routines', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCreate.mockReset();
    mockFetch.mockReset();
    mockImport.mockReset();
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    mockSetStatus.mockReset();
    mockUseApiResource.mockReset();
  });

  it('renders loading and preserves stale data during refresh failure', () => {
    mockUseApiResource.mockReturnValueOnce({
      refresh: mockRefresh,
      state: { status: 'loading', trigger: 'initial' },
    });
    expect(renderScreen().getByTestId('routines-loading')).toBeTruthy();

    const data = fixture();
    mockUseApiResource.mockReturnValueOnce({
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
    expect(renderScreen().getByTestId('routines-stale')).toBeTruthy();
  });

  it('sorts active routines, shows API counts and real colors', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();
    const names = view.getAllByTestId('routine-name').map((node) => node.props.children);

    expect(names).toEqual(['PUSH', 'LEGS']);
    expect(view.getByText('7 ejercicios · 21 series')).toBeTruthy();
    expect(
      view.getByTestId('routine-color-11111111-1111-4111-8111-111111111111-violet', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('shows valid empty and routines unavailable without hiding initial plan', () => {
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: readyState(fixture({ routines: { status: 'ok', data: [] } })),
    });
    const empty = renderScreen();
    expect(empty.getByText('No tenés rutinas activas.')).toBeTruthy();
    empty.unmount();

    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: readyState(fixture({ routines: { status: 'unavailable' } })),
    });
    const unavailable = renderScreen();
    expect(unavailable.getByText('No pudimos cargar la lista de rutinas.')).toBeTruthy();
    fireEvent.press(unavailable.getByRole('button', { name: 'Expandir Opciones avanzadas' }));
    expect(unavailable.getByText(/Plan importado/)).toBeTruthy();
  });

  it('keeps initial-plan unavailable independent from the active list', () => {
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: readyState(fixture({ initialPlan: { status: 'unavailable' } })),
    });
    const view = renderScreen();

    expect(view.getByText('PUSH')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Expandir Opciones avanzadas' }));
    expect(view.getByText('No pudimos verificar el estado del plan inicial.')).toBeTruthy();
  });

  it('expands archived routines and restores with a confirmed desired-state write', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockSetStatus.mockResolvedValue({ status: 'ok', data: {} });
    const view = renderScreen();

    expect(view.queryByText('OLD')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Expandir Archivadas · 1' }));
    expect(view.getByText('OLD')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Más acciones para OLD' }));
    confirmLastAlert();

    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith(
      expect.anything(),
      routines[2].id,
      true,
    ));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('archives an active routine only after confirmation', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockSetStatus.mockResolvedValue({ status: 'ok', data: {} });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Más acciones para PUSH' }));
    expect(mockSetStatus).not.toHaveBeenCalled();
    confirmLastAlert();

    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith(
      expect.anything(),
      routines[1].id,
      false,
    ));
  });

  it('keeps confirmed routine data visible when archive fails', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockSetStatus.mockResolvedValue({ status: 'unavailable', reason: 'server' });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Más acciones para PUSH' }));
    confirmLastAlert();

    await waitFor(() => expect(view.getByText(/No pudimos completar la acción/)).toBeTruthy());
    expect(view.getByText('PUSH')).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('shows editor feedback without navigation or writes', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: /Abrir rutina PUSH/ }));

    expect(view.getByText('El editor de PUSH llega en el próximo paso.')).toBeTruthy();
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('validates create and keeps one idempotency key across an ambiguous retry', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockCreate
      .mockResolvedValueOnce({ status: 'unavailable', reason: 'network' })
      .mockResolvedValueOnce({ status: 'ok', data: { routine: routines[0] } });
    const keyFactory = jest.fn(() => 'stable-key');
    const view = renderScreen(keyFactory);

    fireEvent.press(view.getByRole('button', { name: 'Nueva rutina' }));
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));
    expect(view.getByText('Ingresá un nombre para la rutina.')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();

    fireEvent.changeText(view.getByLabelText('Nombre de la rutina'), '  Push B  ');
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(view.getByText(/No pudimos completar la acción/)).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({ idempotencyKey: 'stable-key' });
    expect(mockCreate.mock.calls[1]?.[1]).toMatchObject({ idempotencyKey: 'stable-key' });
    expect(keyFactory).toHaveBeenCalledTimes(1);
  });

  it('uses a compact close control and a fixed four-by-two color grid', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Nueva rutina' }));

    expect(view.getByRole('button', { name: 'Cerrar nueva rutina' })).toBeTruthy();
    expect(view.queryByText('Cerrar')).toBeNull();
    expect(view.getAllByTestId('routine-color-row')).toHaveLength(2);
    expect(view.getAllByRole('radio')).toHaveLength(8);
  });

  it('uses a new idempotency key for a new intentional creation', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockCreate.mockResolvedValue({ status: 'ok', data: { routine: routines[0] } });
    const keyFactory = jest.fn<() => string>()
      .mockReturnValueOnce('key-one')
      .mockReturnValueOnce('key-two');
    const view = renderScreen(keyFactory);

    fireEvent.press(view.getByRole('button', { name: 'Nueva rutina' }));
    fireEvent.changeText(view.getByLabelText('Nombre de la rutina'), 'Push B');
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

    fireEvent.press(view.getByRole('button', { name: 'Nueva rutina' }));
    fireEvent.changeText(view.getByLabelText('Nombre de la rutina'), 'Pull B');
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));

    expect(mockCreate.mock.calls.map((call) => (
      call[1] as { idempotencyKey: string }
    ).idempotencyKey)).toEqual([
      'key-one',
      'key-two',
    ]);
  });

  it('shows create pending and prevents a duplicate submit', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    let resolveCreate: ((value: unknown) => void) | undefined;
    mockCreate.mockReturnValue(new Promise((resolve) => {
      resolveCreate = resolve;
    }));
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Nueva rutina' }));
    fireEvent.changeText(view.getByLabelText('Nombre de la rutina'), 'Push B');
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));

    await waitFor(() => expect(view.getByRole('button', { name: 'Creando…' })).toBeDisabled());
    fireEvent.press(view.getByRole('button', { name: 'Creando…' }));
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate?.({ status: 'unavailable', reason: 'network' });
    });
  });

  it('imports the initial plan after confirmation and refreshes', async () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    mockImport.mockResolvedValue({
      status: 'ok',
      data: { routines: 5, exercises: 18 },
    });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Expandir Opciones avanzadas' }));
    fireEvent.press(view.getByRole('button', { name: 'Restaurar plan inicial' }));
    expect(mockImport).not.toHaveBeenCalled();
    confirmLastAlert();

    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('supports pull-to-refresh without replacing content', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: readyState() });
    const view = renderScreen();

    fireEvent(view.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(view.getByText('PUSH')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
