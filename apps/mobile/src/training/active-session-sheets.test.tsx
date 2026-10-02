import { fireEvent, render, within } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import type { QuickSessionHistoryDto } from '@/api/active-session';
import { OwnlevelThemeProvider } from '@/design-system';
import { SessionQuickHistory } from './active-session-sheets';
import { EXERCISE_ID, testExercise, testPayload } from './active-session-test-fixtures';
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@/api', () => ({ fetchMobileTrainingExercises: jest.fn(), useApiResource: jest.fn() }));
function historical(index: number): QuickSessionHistoryDto {
  const set = { ...testPayload().sets[0], actualWeightKg: 17.5, actualReps: 10, targetRir: 2, isCompleted: true };
  return { sessionId: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`, logDate: index === 0 ? '2026-09-28' : '2026-09-24', completedAt: null,
    routineId: null, routineName: 'PUSH', decision: 'maintain', sets: [set, { ...set, setNumber: 2, targetRir: 1 }, { ...set, setNumber: 3, isCompleted: false }] };
}
describe('compact native quick-history sheet', () => {
  it('shows latest + previous, completed sets only, compact actuals/RIR and the full date', () => {
    const sessions = Array.from({ length: 7 }, (_, index) => historical(index));
    const view = render(<OwnlevelThemeProvider initialMode="light"><SessionQuickHistory exercise={testExercise()} history={{ status: 'ok', data: { [EXERCISE_ID]: sessions } }} onClose={jest.fn()} onRefresh={jest.fn()} /></OwnlevelThemeProvider>);
    expect(view.getByRole('header', { name: 'Historial' })).toBeTruthy(); expect(view.getAllByText('Última sesión')).toHaveLength(1);
    expect(view.getAllByTestId(/^quick-history-session-/)).toHaveLength(6);
    expect(view.queryByTestId(`quick-history-session-${sessions[6].sessionId}`)).toBeNull();
    const latest = view.getByTestId(`quick-history-session-${sessions[0].sessionId}`);
    expect(within(latest).getByText('28 SEP 2026 · PUSH')).toBeTruthy();
    expect(within(latest).getAllByText('17,5 kg × 10')).toHaveLength(2);
    expect(within(latest).getByText('RIR 2')).toBeTruthy(); expect(within(latest).getByText('RIR 1')).toBeTruthy();
    expect(within(latest).queryByText('3')).toBeNull();
    expect(StyleSheet.flatten(latest.props.style).padding).toBe(12);
  });
  it('keeps unknown actuals distinct from zero and never substitutes targets', () => {
    const session = historical(0);
    session.sets[0] = { ...session.sets[0], actualWeightKg: null, actualReps: null, targetRir: null };
    session.sets[1] = { ...session.sets[1], actualWeightKg: 0, actualReps: 0 };
    const view = render(<OwnlevelThemeProvider initialMode="light"><SessionQuickHistory exercise={testExercise()} history={{ status: 'ok', data: { [EXERCISE_ID]: [session] } }} onClose={jest.fn()} onRefresh={jest.fn()} /></OwnlevelThemeProvider>);
    expect(view.getByText('Sin carga ni reps registradas')).toBeTruthy(); expect(view.getByText('0 kg × 0')).toBeTruthy();
    expect(view.getByText('RIR —')).toBeTruthy(); expect(view.queryByText('40 kg × 8')).toBeNull();
  });
  it('distinguishes true empty history from unavailable and exposes retry/close', () => {
    const refresh = jest.fn(), close = jest.fn();
    const view = render(<OwnlevelThemeProvider initialMode="light"><SessionQuickHistory exercise={testExercise()} history={{ status: 'ok', data: { [EXERCISE_ID]: [] } }} onClose={close} onRefresh={refresh} /></OwnlevelThemeProvider>);
    expect(view.getByText('Todavía sin registros')).toBeTruthy(); expect(view.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    view.rerender(<OwnlevelThemeProvider initialMode="light"><SessionQuickHistory exercise={testExercise()} history={{ status: 'unavailable' }} onClose={close} onRefresh={refresh} /></OwnlevelThemeProvider>);
    expect(view.queryByText('Todavía sin registros')).toBeNull(); fireEvent.press(view.getByRole('button', { name: 'Reintentar' })); expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText('Cerrar Historial')); expect(close).toHaveBeenCalledTimes(1);
  });
});
