import { fireEvent, render, within } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Image, StyleSheet } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { HistoryDay } from '@/api/history';
import type { NutritionReport } from '@/api/nutrition-report';
import type { QuickOption, QuickOptions } from '@/api/nutrition-quick';
import { OwnlevelThemeProvider, type ThemeMode } from '@/design-system';

import { HomeDashboard, type HomeDashboardProps } from './home-dashboard';
import type { HomeTrainingWeek } from './home-data';
import { homeHabituals } from './home-nutrition';
import type { HomeResource } from './home-resource';
import { homeProgressBody, homeProgressTraining } from './home-test-fixtures';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: unknown }) => children, isLiquidGlassAvailable: () => false }));

const TODAY = '2026-10-10'; // Saturday
const WEEK = '2026-10-05';
const NOW = Date.parse('2026-10-10T21:23:00.000Z');

const ready = <T,>(data: T): HomeResource<T> => ({ confirmedAt: NOW - 2 * 3_600_000, data, status: 'ready' });
const loading = <T,>(): HomeResource<T> => ({ confirmedAt: null, data: undefined, status: 'loading' });
const unavailable = <T,>(data?: T): HomeResource<T> => ({ confirmedAt: data ? NOW - 2 * 3_600_000 : null, data, status: 'unavailable' });

function home(): MobileHomeResponse {
  return {
    date: TODAY,
    profile: { status: 'ok', data: { displayName: 'Nacho Ownlevel' } },
    nutrition: { status: 'ok', data: { calories: 1840, calorieTarget: 2600, proteinG: 128, proteinTargetG: 160, mealCount: 3, waterL: 2, waterTargetL: 3, energyBalanceKcal: -300 } },
    training: {
      activeSession: { status: 'ok', data: null },
      workoutStartRoutines: { status: 'ok', data: [{ id: 'r1', name: 'Push', color: 'violet', exerciseCount: 6, setCount: 18 }] },
      week: {
        status: 'ok',
        data: {
          summary: { weekStart: WEEK, weekEnd: '2026-10-11', sessions: 3, sets: 54, minutes: 157, routines: { Push: 1 }, muscleGroups: { Pecho: 8 }, trainingDays: ['2026-10-05', '2026-10-06', '2026-10-08'] },
          todaySessions: [],
        },
      },
    },
  };
}

const metric = (id: string, label: string, systemKey: 'sleep' | 'water' | null, value: number | null, isActive = true) => ({
  id, systemKey, label, unit: null, valueType: 'decimal' as const, target: null, value, isActive, updatedAt: null,
});

function todayDay(): HistoryDay {
  return {
    date: TODAY, today: TODAY, discovery: null,
    training: { status: 'ok', data: { sessions: [] } },
    activeSession: { status: 'ok', data: null },
    nutrition: { status: 'ok', data: { dayState: 'recorded', summary: {
      calories: { knownTotal: 1840, missingCount: 0 }, proteinG: { knownTotal: 128, missingCount: 0 },
      carbsG: { knownTotal: 210, missingCount: 0 }, fatG: { knownTotal: 52, missingCount: 0 }, entryCount: 3, mealCount: 3,
    }, context: {} as never } },
    body: { date: TODAY, today: TODAY, weight: { status: 'ok', data: null }, measurement: { status: 'ok', data: null } },
    metrics: { status: 'ok', data: { metrics: [metric('m-archived', 'Mate', null, 1, false), metric('m-sleep', 'Sueño', 'sleep', 7.5), metric('m-energy', 'Energía', null, null), metric('m-water', 'Agua', 'water', 2)] } },
  } as HistoryDay;
}

const option = (kind: 'saved' | 'suggestion', id: string, name: string): QuickOption => ({
  source: { kind, id, version: 'a'.repeat(64) }, name, description: null, templateType: null, items: [],
  calories: 300, proteinG: 20, carbsG: 30, fatG: 10, useCount: null, lastUsedDate: null,
});
const breakfast = option('suggestion', '00000000-0000-4000-8000-000000000001', 'Desayuno de siempre');
const quickOptions: QuickOptions = {
  today: TODAY,
  saved: { status: 'ok', items: [option('saved', '00000000-0000-4000-8000-000000000003', 'Avena guardada')] },
  suggested: { status: 'ok', items: [breakfast, option('suggestion', '00000000-0000-4000-8000-000000000002', 'Batido')] },
};

const calorieRow = (date: string, value: number | null, isToday = false) => ({
  date, exists: true, hasNutrition: value !== null, imported: false, isToday, mealCount: value === null ? 0 : 3,
  nutrients: { calories: { value, knownMeals: 3, missingMeals: 0, status: value === null ? 'none' : 'complete' } },
  targetCalories: 2600, targetProteinG: null, expenditureKcal: null, targetDeviationKcal: null, energyBalanceKcal: null, goalStage: null,
});
const report = {
  summary: { metrics: { calories: { value: 2410, denominator: 4, partialDays: 0 } } },
  days: [calorieRow('2026-10-05', 2500), calorieRow('2026-10-06', 2300), calorieRow('2026-10-07', null), calorieRow('2026-10-08', 2400),
    calorieRow('2026-10-09', 2440), calorieRow(TODAY, 1840, true)],
} as unknown as NutritionReport;

const sessionAt = (id: string, logDate: string, completedSets: number, minutes: number | null) => ({
  id, routineId: null, routineName: 'Push', routineColor: null, logDate, startedAt: `${logDate}T12:00:00.000Z`, endedAt: `${logDate}T13:00:00.000Z`,
  durationMilliseconds: minutes === null ? null : minutes * 60_000, exercisesCompleted: 4, completedSets, volumeKg: null,
});
const trainingWeek: HomeTrainingWeek = { weekStart: WEEK, everTrained: true, sessions: [
  sessionAt('s1', '2026-10-05', 18, 52), sessionAt('s2', '2026-10-06', 12, 30), sessionAt('s3', '2026-10-06', 8, 28), sessionAt('s4', '2026-10-08', 16, 47),
] };

function renderHome(overrides: Partial<HomeDashboardProps> = {}, theme: ThemeMode = 'light') {
  const handlers = {
    onConfigureNutrition: jest.fn(), onCreateRoutine: jest.fn(), onNavigate: jest.fn(), onNewMeal: jest.fn(), onOpenCompletedSession: jest.fn(),
    onOpenDay: jest.fn(), onOpenProgress: jest.fn(), onOpenSession: jest.fn(), onQuickMeal: jest.fn(), onRefresh: jest.fn(), onRegister: jest.fn(), onStartWorkout: jest.fn(),
  };
  const props: HomeDashboardProps = {
    ...handlers,
    avatarUrl: null,
    calories: ready(report),
    day: { today: TODAY, weekStart: WEEK },
    home: ready(home()),
    progressBody: ready(homeProgressBody()), progressTraining: ready(homeProgressTraining()), progressRecords: ready(homeProgressTraining('30')),
    now: () => NOW,
    quick: ready(quickOptions),
    today: ready(todayDay()),
    training: ready(trainingWeek),
    ...overrides,
  };
  const view = render(<OwnlevelThemeProvider initialMode={theme}><HomeDashboard {...props} /></OwnlevelThemeProvider>);
  return { ...view, ...handlers };
}

describe('Home header', () => {
  it('shows only the date and opens Profile/Settings from the avatar and the isotype', () => {
    const view = renderHome();
    expect(view.getByText('SÁBADO 10 DE OCTUBRE')).toBeTruthy();
    expect(view.queryByText(/Hola/)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir ajustes' }));
    expect(view.onNavigate.mock.calls).toEqual([['settings'], ['settings']]);
  });

  it('uses the Google photo when there is one, the initial when it fails', () => {
    const view = renderHome({ avatarUrl: 'https://lh3.googleusercontent.com/a/photo' });
    const photo = view.getByTestId('home-avatar-photo', { includeHiddenElements: true });
    expect(photo.props.source).toEqual({ uri: 'https://lh3.googleusercontent.com/a/photo' });
    fireEvent(photo, 'error');
    const avatar = view.getByTestId('home-avatar', { includeHiddenElements: true });
    expect(within(avatar).getByText('N', { includeHiddenElements: true })).toBeTruthy();
  });

  it.each([['light', require('../../assets/brand/logo/isotipo-claro.png')], ['dark', require('../../assets/brand/logo/isotipo-oscuro.png')]] as [ThemeMode, unknown][])(
    'uses the real isotype for a %s background', (theme, asset) => {
      const view = renderHome({}, theme);
      expect(view.UNSAFE_getAllByType(Image).some(image => image.props.source === asset)).toBe(true);
    });

  it('without a name keeps the date and never inserts a greeting', () => {
    const data = home();
    data.profile = { status: 'ok', data: { displayName: null } };
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('SÁBADO 10 DE OCTUBRE')).toBeTruthy();
    expect(view.queryByText(/Hola/)).toBeNull();
    expect(view.queryByText(/Perfil/)).toBeNull();
  });
});

describe('Training card: states by priority', () => {
  it('active session first: champagne hero with minutes and exercises; Volver opens the session', () => {
    const data = home();
    data.training.activeSession = { status: 'ok', data: { id: 'act', name: 'Push', logDate: TODAY, startedAt: '2026-10-10T21:00:00.000Z',
      exercisesCompleted: 3, totalExercises: 6, completedSets: 9, totalSets: 18, progressPercent: 50 } };
    if (data.training.week.status === 'ok') data.training.week.data.todaySessions = [{ id: 'done', name: 'Pull', startedAt: '2026-10-10T11:00:00.000Z',
      endedAt: '2026-10-10T12:00:00.000Z', durationMilliseconds: 3_600_000, exercisesCompleted: 4, completedSets: 12, status: 'completed' }];
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('SESIÓN EN CURSO')).toBeTruthy();
    expect(view.getByText('Push · 23 min')).toBeTruthy();
    expect(view.getByText('3 de 6 ejercicios')).toBeTruthy();
    expect(view.queryByText('ENTRENASTE HOY')).toBeNull();
    const hero = StyleSheet.flatten(view.getByTestId('home-hero-active').props.style);
    expect(hero.experimental_backgroundImage).toBe('linear-gradient(150deg, #DCCBA3 0%, #A8935F 100%)');
    fireEvent.press(view.getByRole('button', { name: 'Volver' }));
    expect(view.onOpenSession).toHaveBeenCalledWith('act');
  });

  it('trained today: the last finished session and Ver detalle opens its real detail', () => {
    const data = home();
    if (data.training.week.status === 'ok') data.training.week.data.todaySessions = [
      { id: 'early', name: 'Movilidad', startedAt: '2026-10-10T10:00:00.000Z', endedAt: '2026-10-10T10:20:00.000Z', durationMilliseconds: 20 * 60_000, exercisesCompleted: 3, completedSets: 6, status: 'completed' },
      { id: 'late', name: 'Push', startedAt: '2026-10-10T18:00:00.000Z', endedAt: '2026-10-10T18:55:00.000Z', durationMilliseconds: 55 * 60_000, exercisesCompleted: 6, completedSets: 18, status: 'completed' },
    ];
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('ENTRENASTE HOY')).toBeTruthy();
    expect(view.getByText('Push · 55 min')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Ver detalle' }));
    expect(view.onOpenCompletedSession).toHaveBeenCalledWith('late');
    fireEvent.press(view.getByRole('button', { name: 'Entrenar otra vez' }));
    expect(view.onStartWorkout).toHaveBeenCalledTimes(1);
  });

  it('no planned routine exists in the product: free day, Elegir rutina opens the start modal directly', () => {
    const view = renderHome();
    expect(view.getByText('DÍA LIBRE')).toBeTruthy();
    expect(view.getByText('¿Entrenás hoy?')).toBeTruthy();
    expect(view.queryByText('HOY TOCA')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Elegir rutina' }));
    expect(view.onStartWorkout).toHaveBeenCalledTimes(1);
    expect(view.onNavigate).not.toHaveBeenCalled();
  });

  it('new user without routines: first step with Crear rutina and Entrenar libre', () => {
    const data = home();
    data.training.workoutStartRoutines = { status: 'ok', data: [] };
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('PRIMER PASO')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina' }));
    fireEvent.press(view.getByRole('button', { name: 'Entrenar libre' }));
    expect(view.onCreateRoutine).toHaveBeenCalledTimes(1);
    expect(view.onStartWorkout).toHaveBeenCalledTimes(1);
  });

  it('an unverifiable active-session state never offers a start', () => {
    const data = home();
    data.training.activeSession = { status: 'unavailable' };
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('Estado no disponible')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Elegir rutina' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Entrenar otra vez' })).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(view.onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('Nutrition', () => {
  it('ring shows what is left; protein against its target; carbs and fat from today', () => {
    const view = renderHome();
    expect(view.getByText('1.840 de 2.600 kcal')).toBeTruthy();
    expect(view.getByLabelText('760 kcal restantes')).toBeTruthy();
    expect(view.getByLabelText('Proteína: 128 de 160 gramos')).toBeTruthy();
    expect(view.getByText('210 g')).toBeTruthy();
    expect(view.getByText('52 g')).toBeTruthy();
  });

  it('over the target says so (same color, full ring)', () => {
    const data = home();
    if (data.nutrition.status === 'ok') data.nutrition.data.calories = 2720;
    expect(renderHome({ home: ready(data) }).getByLabelText('120 kcal sobre el objetivo')).toBeTruthy();
  });

  it('no meals today: dashed ring and "—", never 0 kcal', () => {
    const data = home();
    if (data.nutrition.status === 'ok') Object.assign(data.nutrition.data, { calories: 0, proteinG: 0, mealCount: 0 });
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('Todavía no cargaste comidas hoy')).toBeTruthy();
    expect(view.getByTestId('home-calorie-ring-empty', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByText(/^0 kcal|kcal restantes/)).toBeNull();
    expect(view.getByText('objetivo 2.600 kcal')).toBeTruthy();
  });

  it('without a calorie target: only what was eaten and a link to configure it', () => {
    const data = home();
    if (data.nutrition.status === 'ok') data.nutrition.data.calorieTarget = null;
    const view = renderHome({ home: ready(data) });
    expect(view.getByLabelText('1.840 kcal consumidas')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: /Configurá tu objetivo/ }));
    expect(view.onConfigureNutrition).toHaveBeenCalledTimes(1);
  });

  it('habituals: the 2 suggested (server frequency order) first, saved only to fill', () => {
    expect(homeHabituals(quickOptions).map(o => o.name)).toEqual(['Desayuno de siempre', 'Batido']);
    expect(homeHabituals({ ...quickOptions, suggested: { status: 'ok', items: [breakfast] } }).map(o => o.name)).toEqual(['Desayuno de siempre', 'Avena guardada']);
    expect(homeHabituals({ ...quickOptions, suggested: { status: 'unavailable' } }).map(o => o.name)).toEqual(['Avena guardada']);
  });

  it('Nueva comida and a habitual open the existing Nutrition flows (A2)', () => {
    const view = renderHome();
    fireEvent.press(view.getByRole('button', { name: 'Nueva comida' }));
    fireEvent.press(view.getByRole('button', { name: 'Batido' }));
    expect(view.onNewMeal).toHaveBeenCalledTimes(1);
    expect(view.onQuickMeal.mock.calls[0][0]).toMatchObject({ name: 'Batido', source: { kind: 'suggestion' } });
  });

  it('carbs and fat show "—" when their read fails; the training card does not wait for nutrition', () => {
    const view = renderHome({ today: unavailable() });
    expect(view.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('DÍA LIBRE')).toBeTruthy();
  });
});

describe('Tu semana', () => {
  it('trainings with sets and time, no "de N" (no weekly goal exists), no routines or muscles', () => {
    const view = renderHome();
    const training = view.getByTestId('home-week-training');
    expect(within(training).getByText('3')).toBeTruthy();
    expect(within(training).getByText('54 series · 2 h 37 min')).toBeTruthy();
    expect(view.queryByText(/ de 4/)).toBeNull();
    expect(view.queryByText(/Pecho|Músculos|Rutinas/)).toBeNull();
  });

  it('calories per day: reports average and day count, empty bar without data, today dimmer', () => {
    const view = renderHome();
    const calories = view.getByTestId('home-week-calories');
    expect(within(calories).getByText('2.410 prom.')).toBeTruthy();
    expect(within(calories).getByText('4 de 7 días con datos')).toBeTruthy();
    expect(view.queryByTestId('home-week-bar-2026-10-07')).toBeNull();
    expect(StyleSheet.flatten(view.getByTestId(`home-week-bar-${TODAY}`).props.style).opacity).toBe(0.55);
    expect(StyleSheet.flatten(view.getByTestId('home-week-bar-2026-10-05').props.style).opacity).toBe(1);
  });

  it('7-day strip marks trained days without sets or minutes; today is identified and each past day opens history', () => {
    const view = renderHome();
    expect(view.getByLabelText('Martes: entrenaste')).toBeTruthy();
    expect(within(view.getByTestId('home-week-strip')).queryByText(/ser\.|min/)).toBeNull();
    expect(view.getByLabelText('Miércoles: sin entrenamiento')).toBeTruthy();
    expect(view.getByLabelText('Sábado, hoy: sin entrenamiento')).toBeTruthy();
    expect(view.getByText('Hoy')).toBeTruthy();
    fireEvent.press(view.getByTestId('home-week-day-2026-10-06'));
    expect(view.onOpenDay).toHaveBeenCalledWith('2026-10-06');
    fireEvent.press(view.getByRole('button', { name: 'Ver progreso' }));
    expect(view.onNavigate).toHaveBeenCalledWith('progress');
  });

  it('each part keeps its own unavailable state', () => {
    const view = renderHome({ calories: unavailable(), training: unavailable() });
    expect(view.getByText('No pudimos cargar las calorías de la semana.')).toBeTruthy();
    expect(view.getByText('No pudimos cargar el detalle por día.')).toBeTruthy();
    expect(within(view.getByTestId('home-week-training')).getByText('3')).toBeTruthy();
  });

  it('a user who never trained sees a greyed EJEMPLO week', () => {
    const view = renderHome({ training: ready({ weekStart: WEEK, everTrained: false, sessions: [] }) });
    expect(view.getByText('EJEMPLO')).toBeTruthy();
    expect(view.getByText('Con tu primer entrenamiento, esto pasa a ser tuyo.')).toBeTruthy();
    expect(view.queryByTestId('home-week-strip')).toBeNull();
  });
});

describe('Registrar', () => {
  it('the first two active metrics + Más métricas + pending Peso, with checks on today\'s metrics', () => {
    const view = renderHome();
    const register = view.getByTestId('home-register');
    expect(within(register).getAllByRole('button').map(button => button.props.accessibilityLabel)).toEqual(['Sueño', 'Energía', 'Más métricas', 'Peso']);
    expect(within(register).getByRole('button', { name: 'Sueño' }).props.accessibilityState).toEqual({ checked: true });
    expect(within(register).getByRole('button', { name: 'Energía' }).props.accessibilityState).toEqual({ checked: false });
    expect(within(register).getByRole('button', { name: 'Peso' }).props.accessibilityState).toEqual({ checked: false });
    fireEvent.press(within(register).getByRole('button', { name: 'Peso' }));
    fireEvent.press(within(register).getByRole('button', { name: 'Sueño' }));
    fireEvent.press(within(register).getByRole('button', { name: 'Más métricas' }));
    expect(view.onRegister.mock.calls).toEqual([[{ kind: 'weight' }], [{ kind: 'metric', metricId: 'm-sleep' }], [{ kind: 'more' }]]);
  });

  it('a weight registered today is omitted from Registrar', () => {
    const day = todayDay();
    day.body.weight = { status: 'ok', data: { date: TODAY, weightKg: 80 } as never };
    const view = renderHome({ today: ready(day) });
    expect(within(view.getByTestId('home-register')).queryByRole('button', { name: 'Peso' })).toBeNull();
  });

  it('an unavailable, loading, stale or previous-day read does not invent a pending weight', () => {
    const oldDay = todayDay(); oldDay.date = '2026-10-09';
    const failedWeight = todayDay(); failedWeight.body.weight = { status: 'unavailable' };
    for (const today of [loading<HistoryDay>(), unavailable<HistoryDay>(), unavailable(todayDay()), ready(oldDay), ready(failedWeight)]) {
      const view = renderHome({ today });
      expect(within(view.getByTestId('home-register')).queryByRole('button', { name: 'Peso' })).toBeNull();
      view.unmount();
    }
  });
});

describe('Screen states', () => {
  it('loading: blocks that need Home show their own skeleton; independent reads still render', () => {
    const view = renderHome({ home: loading() });
    expect(view.getByTestId('home-nutrition-loading')).toBeTruthy();
    expect(view.getByText('SÁBADO 10 DE OCTUBRE')).toBeTruthy();
    expect(view.getByTestId('home-week-strip')).toBeTruthy();
    expect(view.getByTestId('home-register')).toBeTruthy();
  });

  it('offline with a cached read: notice with its age and retry', () => {
    const view = renderHome({ home: unavailable(home()) });
    expect(view.getByText('Uy, no pudimos actualizar')).toBeTruthy();
    expect(view.getByText('Te mostramos lo último que cargó, de hace 2 h. Tus datos están guardados.')).toBeTruthy();
    fireEvent.press(within(view.getByTestId('home-offline')).getByRole('button', { name: 'Reintentar' }));
    expect(view.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('progress follows Registrar and has a link to the existing overview', () => {
    const view = renderHome();
    expect(view.queryByText('Accesos rápidos')).toBeNull();
    expect(view.getByTestId('home-progress')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Ver todo' }));
    expect(view.onNavigate).toHaveBeenCalledWith('progress');
  });

  it.each(['dark', 'light', 'system'] as const)('renders in %s mode', theme => {
    expect(renderHome({}, theme).getByTestId('real-home-dashboard')).toBeTruthy();
  });
});
