import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import type { MobileTrainingResponse } from '@/api/training';
import { OwnlevelThemeProvider } from '@/design-system';

import {
  TrainingDashboard,
  type TrainingDeferredAction,
} from './training-dashboard';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

function fixture(): MobileTrainingResponse {
  return {
    activeSession: { status: 'ok', data: null },
    calendar: {
      status: 'ok',
      data: {
        month: '2026-09',
        days: [
          { date: '2026-09-21', colors: ['violet', 'blue', 'rose'] },
        ],
      },
    },
  };
}

function renderDashboard(data = fixture()) {
  const onDeferredAction = jest.fn<(action: TrainingDeferredAction) => void>();
  const onNewSession = jest.fn();
  const onContinueSession = jest.fn();
  const onRefresh = jest.fn();
  const view = render(
    <OwnlevelThemeProvider initialMode="light">
      <TrainingDashboard
        data={data}
        isStale={false}
        notice={null}
        onDeferredAction={onDeferredAction}
        onNewSession={onNewSession}
        onContinueSession={onContinueSession}
        onRefresh={onRefresh}
        requestedMonth="2026-09"
        today="2026-09-21"
      />
    </OwnlevelThemeProvider>,
  );
  return { ...view, onDeferredAction, onNewSession, onContinueSession, onRefresh };
}

describe('native Training landing', () => {
  it('opens the real start flow from New Session', () => {
    const view = renderDashboard();

    fireEvent.press(view.getByRole('button', { name: '+ Nueva sesión' }));

    expect(view.onNewSession).toHaveBeenCalledTimes(1);
    expect(view.queryByText('Sesión en curso')).toBeNull();
  });

  it('renders an active session without opening an editor', () => {
    const data = fixture();
    data.activeSession = {
      status: 'ok',
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Upper A',
        logDate: '2026-09-21',
      },
    };
    const view = renderDashboard(data);

    expect(view.getByText('Sesión en curso')).toBeTruthy();
    expect(view.getByText('Upper A')).toBeTruthy();
    expect(view.getByText(/Iniciada 21 de septiembre de 2026/)).toBeTruthy();
    fireEvent.press(
      view.getByRole('button', { name: 'Continuar entrenamiento →' }),
    );
    expect(view.onContinueSession).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('keeps the calendar when active-session status is unavailable', () => {
    const data = fixture();
    data.activeSession = { status: 'unavailable' };
    const view = renderDashboard(data);

    expect(view.getByTestId('training-session-unavailable')).toBeTruthy();
    expect(view.getByTestId('training-calendar')).toBeTruthy();
    expect(view.getByText('1 día con entrenamiento')).toBeTruthy();
  });

  it('keeps the session CTA when only calendar is unavailable', () => {
    const data = fixture();
    data.calendar = { status: 'unavailable' };
    const view = renderDashboard(data);

    expect(view.getByRole('button', { name: '+ Nueva sesión' })).toBeTruthy();
    expect(view.getByText('No pudimos cargar el calendario de este mes.')).toBeTruthy();
  });

  it('shows a valid empty calendar, today and every routine color for a date', () => {
    const view = renderDashboard();

    expect(view.getByText('1 día con entrenamiento')).toBeTruthy();
    expect(view.getByTestId('training-calendar-today')).toBeTruthy();
    expect(view.getByLabelText(/hoy, entrenamiento: violeta, azul, rosa/)).toBeTruthy();
    expect(
      view.getByTestId('training-color-2026-09-21-violet', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      view.getByTestId('training-color-2026-09-21-blue', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      view.getByTestId('training-color-2026-09-21-rose', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    const empty = fixture();
    if (empty.calendar.status === 'ok') empty.calendar.data.days = [];
    const emptyView = renderDashboard(empty);
    expect(emptyView.getByText('0 días con entrenamiento')).toBeTruthy();
  });

  it('routes every future surface to feedback only', () => {
    const view = renderDashboard();

    fireEvent.press(view.getByRole('button', { name: 'Abrir Rutinas' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Ejercicios' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Historial' }));

    expect(view.onDeferredAction.mock.calls.map(([action]) => action)).toEqual([
      'routines',
      'exercises',
      'history',
    ]);
  });

  it('labels preserved data as stale and retries without replacing content', () => {
    const onDeferredAction = jest.fn();
    const onRefresh = jest.fn();
    const view = render(
      <OwnlevelThemeProvider initialMode="dark">
        <TrainingDashboard
          data={fixture()}
          isStale
          notice={null}
          onDeferredAction={onDeferredAction}
          onNewSession={jest.fn()}
          onContinueSession={jest.fn()}
          onRefresh={onRefresh}
          requestedMonth="2026-09"
          today="2026-09-21"
        />
      </OwnlevelThemeProvider>,
    );

    expect(view.getByTestId('training-calendar')).toBeTruthy();
    expect(
      view.getByText('No se pudo actualizar. Mostramos la última lectura confirmada.'),
    ).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
