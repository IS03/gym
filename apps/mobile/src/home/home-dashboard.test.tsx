import { fireEvent, render, within } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { HistoryDay } from '@/api/history';
import type { NutritionReport } from '@/api/nutrition-report';
import type { QuickOption, QuickOptions } from '@/api/nutrition-quick';
import { OwnlevelThemeProvider, type ThemeMode } from '@/design-system';

import { HomeDashboard, type HomeDashboardProps } from './home-dashboard';
import type { HomeTrainingWeek } from './home-data';
import { calorieSplit, homeHabituals } from './home-nutrition';
import type { HomeResource } from './home-resource';
import { homeProgressBody, homeProgressTraining } from './home-test-fixtures';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
// The native "+" menu has its own test; here a stub exposes its entries as buttons.
jest.mock('./home-add-menu', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { HomeAddMenu: ({ habituals, onAll, onFood, onHabitual, onManual }: import('./home-add-menu.types').HomeAddMenuProps) => (
    <View testID="home-add-menu">
      <Pressable accessibilityRole="button" onPress={onManual}><Text>Comida manual</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onFood}><Text>Buscar alimento</Text></Pressable>
      {habituals.map(option => <Pressable accessibilityRole="button" key={option.source.id} onPress={() => onHabitual(option)}><Text>{option.name}</Text></Pressable>)}
      <Pressable accessibilityRole="button" onPress={onAll}><Text>Ver todas</Text></Pressable>
    </View>
  ) };
});

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
    onConfigureNutrition: jest.fn(), onCreateRoutine: jest.fn(), onMealEntry: jest.fn(), onNavigate: jest.fn(), onOpenCompletedSession: jest.fn(),
    onOpenDay: jest.fn(), onOpenProgress: jest.fn(), onOpenSession: jest.fn(), onQuickMeal: jest.fn(), onRefresh: jest.fn(), onRegister: jest.fn(), onStartWorkout: jest.fn(),
  };
  const props: HomeDashboardProps = {
    ...handlers,
    avatarUrl: null,
    calories: ready(report),
    day: { today: TODAY, weekStart: WEEK },
    home: ready(home()),
    progressBody: ready(homeProgressBody()), progressRecords: ready(homeProgressTraining('30')),
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
  it('large title "Hoy" under the uppercase date; the 36 pt photo opens Profile/Settings; no isotype', () => {
    const view = renderHome();
    expect(view.getByText('SÁBADO 10 DE OCTUBRE')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Hoy' })).toBeTruthy();
    expect(view.queryByTestId('home-isotype')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil y ajustes' }));
    expect(view.onNavigate).toHaveBeenCalledWith('settings');
  });

  it('uses the Google photo when there is one, the initial when it fails', () => {
    const view = renderHome({ avatarUrl: 'https://lh3.googleusercontent.com/a/photo' });
    const photo = view.getByTestId('home-avatar-photo', { includeHiddenElements: true });
    expect(photo.props.source).toEqual({ uri: 'https://lh3.googleusercontent.com/a/photo' });
    expect(StyleSheet.flatten(photo.props.style)).toMatchObject({ height: 36, width: 36 });
    fireEvent(photo, 'error');
    const avatar = view.getByTestId('home-avatar', { includeHiddenElements: true });
    expect(within(avatar).getByText('N', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Training card: states by priority, sentence case, capsule actions', () => {
  it('active session first: hero with the routine, minutes and exercises; Volver opens the session', () => {
    const data = home();
    data.training.activeSession = { status: 'ok', data: { id: 'act', name: 'Push', logDate: TODAY, startedAt: '2026-10-10T21:00:00.000Z',
      exercisesCompleted: 3, totalExercises: 6, completedSets: 9, totalSets: 18, progressPercent: 50 } };
    if (data.training.week.status === 'ok') data.training.week.data.todaySessions = [{ id: 'done', name: 'Pull', startedAt: '2026-10-10T11:00:00.000Z',
      endedAt: '2026-10-10T12:00:00.000Z', durationMilliseconds: 3_600_000, exercisesCompleted: 4, completedSets: 12, status: 'completed' }];
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('Sesión en curso')).toBeTruthy();
    expect(view.getByText('Push')).toBeTruthy();
    expect(view.getByText('23 min · 3 de 6 ejercicios')).toBeTruthy();
    expect(view.queryByText(/[A-ZÁÉÍÓÚ]{4,} [A-ZÁÉÍÓÚ]{2,}/)).toBeNull();
    expect(view.queryByText('Entrenaste hoy')).toBeNull();
    const hero = StyleSheet.flatten(view.getByTestId('home-hero-active').props.style);
    expect(hero.experimental_backgroundImage).toBe('linear-gradient(150deg, #DCCBA3 0%, #A8935F 100%)');
    fireEvent.press(view.getByRole('button', { name: 'Volver' }));
    expect(view.onOpenSession).toHaveBeenCalledWith('act');
  });

  it('trained today: every finished routine, each with a Ver detalle capsule; Entrenar otra vez stays quiet', () => {
    const data = home();
    if (data.training.week.status === 'ok') data.training.week.data.todaySessions = [
      { id: 'late', name: 'Push', startedAt: '2026-10-10T18:00:00.000Z', endedAt: '2026-10-10T18:55:00.000Z', durationMilliseconds: 55 * 60_000, exercisesCompleted: 6, completedSets: 18, status: 'completed' },
      { id: 'early', name: 'Movilidad', startedAt: '2026-10-10T10:00:00.000Z', endedAt: '2026-10-10T10:20:00.000Z', durationMilliseconds: 20 * 60_000, exercisesCompleted: 3, completedSets: 6, status: 'completed' },
    ];
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('Entrenaste hoy')).toBeTruthy();
    expect(view.getByText('20 min · 6 series')).toBeTruthy();
    expect(view.getByText('55 min · 18 series')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Push. 55 min · 18 series. Ver detalle' }));
    fireEvent.press(view.getByRole('button', { name: 'Movilidad. 20 min · 6 series. Ver detalle' }));
    expect(view.onOpenCompletedSession.mock.calls).toEqual([['late'], ['early']]);
    fireEvent.press(view.getByRole('button', { name: 'Entrenar otra vez' }));
    expect(view.onStartWorkout).toHaveBeenCalledTimes(1);
  });

  it('no planned routine exists in the product: free day, Elegir rutina opens the start modal directly', () => {
    const view = renderHome();
    expect(view.getByText('Día libre')).toBeTruthy();
    expect(view.getByText('¿Entrenás hoy?')).toBeTruthy();
    expect(view.queryByText(/Hoy toca/i)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Elegir rutina' }));
    expect(view.onStartWorkout).toHaveBeenCalledTimes(1);
    expect(view.onNavigate).not.toHaveBeenCalled();
  });

  it('new user without routines: first step with Crear rutina and Entrenar libre', () => {
    const data = home();
    data.training.workoutStartRoutines = { status: 'ok', data: [] };
    const view = renderHome({ home: ready(data) });
    expect(view.getByText('Primer paso')).toBeTruthy();
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
  it('champagne title and "+"; concentric rings with what is left; legend with consumed / target', () => {
    const view = renderHome();
    expect(view.getByRole('header', { name: 'Nutrición' })).toBeTruthy();
    expect(view.getByTestId('home-add-menu')).toBeTruthy();
    expect(view.getByLabelText('760 restantes')).toBeTruthy();
    expect(view.getByText('1.840 / 2.600 kcal')).toBeTruthy();
    expect(view.getByText('128 / 160 g')).toBeTruthy();
    expect(view.queryByText('AGREGAR RÁPIDO')).toBeNull();
  });

  it('calorie split uses 4/4/9 kcal per gram, with grams and the share of each macro', () => {
    // 128 g protein = 512, 210 g carbs = 840, 52 g fat = 468 → 1.820 kcal.
    const view = renderHome();
    const split = within(view.getByTestId('home-calorie-split'));
    expect(split.getByText('128 g · 28 %')).toBeTruthy();
    expect(split.getByText('210 g · 46 %')).toBeTruthy();
    expect(split.getByText('52 g · 26 %')).toBeTruthy();
    expect(calorieSplit(10, 10, 0)).toEqual({ carbs: 0.5, fat: 0, protein: 0.5 });
    expect(calorieSplit(0, 0, 0)).toBeNull();
    expect(calorieSplit(10, null, 5)).toBeNull();
  });

  it('over the target says so in the center (same color, full ring)', () => {
    const data = home();
    if (data.nutrition.status === 'ok') data.nutrition.data.calories = 2720;
    expect(renderHome({ home: ready(data) }).getByLabelText('120 de más')).toBeTruthy();
  });

  it('nothing logged today: empty rings with the whole target left, 0 / target and 0 g macros without a split', () => {
    const data = home();
    if (data.nutrition.status === 'ok') Object.assign(data.nutrition.data, { calories: 0, proteinG: 0, mealCount: 0 });
    const day = todayDay();
    day.nutrition = { status: 'ok', data: { dayState: 'missing', summary: null, context: null } } as HistoryDay['nutrition'];
    const view = renderHome({ home: ready(data), today: ready(day) });
    expect(view.getByLabelText('2.600 restantes')).toBeTruthy();
    expect(view.getAllByText('0 g')).toHaveLength(3);
    expect(view.getByLabelText('Sin reparto todavía')).toBeTruthy();
  });

  it('without a calorie target: only what was eaten and a link to configure it', () => {
    const data = home();
    if (data.nutrition.status === 'ok') data.nutrition.data.calorieTarget = null;
    const view = renderHome({ home: ready(data) });
    expect(view.getByLabelText('1.840 consumidas')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: /Configurá tu objetivo/ }));
    expect(view.onConfigureNutrition).toHaveBeenCalledTimes(1);
  });

  it('habituals: the 2 suggested (server frequency order) first, saved only to fill', () => {
    expect(homeHabituals(quickOptions).map(o => o.name)).toEqual(['Desayuno de siempre', 'Batido']);
    expect(homeHabituals({ ...quickOptions, suggested: { status: 'ok', items: [breakfast] } }).map(o => o.name)).toEqual(['Desayuno de siempre', 'Avena guardada']);
    expect(homeHabituals({ ...quickOptions, suggested: { status: 'unavailable' } }).map(o => o.name)).toEqual(['Avena guardada']);
  });

  it('the "+" menu opens the existing flows: manual, food search, a habitual (A2) and the full list', () => {
    const view = renderHome();
    const menu = within(view.getByTestId('home-add-menu'));
    fireEvent.press(menu.getByText('Comida manual'));
    fireEvent.press(menu.getByText('Buscar alimento'));
    fireEvent.press(menu.getByText('Batido'));
    fireEvent.press(menu.getByText('Ver todas'));
    expect(view.onMealEntry.mock.calls).toEqual([['manual'], ['food'], ['quick']]);
    expect(view.onQuickMeal.mock.calls[0][0]).toMatchObject({ name: 'Batido', source: { kind: 'suggestion' } });
  });

  it('carbs and fat show "—" when their read fails; the training card does not wait for nutrition', () => {
    const view = renderHome({ today: unavailable() });
    expect(view.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('Día libre')).toBeTruthy();
  });
});

describe('Esta semana', () => {
  it('grouped list: trainings with value, sets and time and the 7 days; no "de N", routines or muscles', () => {
    const view = renderHome();
    const training = view.getByTestId('home-week-training');
    expect(within(training).getByText('3')).toBeTruthy();
    expect(within(training).getByText('54 series · 2 h 37 min')).toBeTruthy();
    expect(view.queryByText(/ de 4/)).toBeNull();
    expect(view.queryByText(/Pecho|Músculos|Rutinas/)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Progreso' }));
    expect(view.onNavigate).toHaveBeenCalledWith('progress');
  });

  it('calories per day: the reports average and "k de 7 días con datos"', () => {
    const calories = within(renderHome().getByTestId('home-week-calories'));
    expect(calories.getByText('2.410')).toBeTruthy();
    expect(calories.getByText('Promedio · 4 de 7 días con datos')).toBeTruthy();
  });

  it('days: filled when trained; only today is marked differently; each past day opens history', () => {
    const view = renderHome();
    expect(view.getByLabelText('Lunes: entrenaste')).toBeTruthy();
    expect(view.getByLabelText('Miércoles: sin entrenamiento')).toBeTruthy();
    expect(view.getByLabelText('Sábado, hoy: sin entrenamiento')).toBeTruthy();
    expect(view.getByTestId('home-week-today').props.children).toBe('S');
    fireEvent.press(view.getByTestId('home-week-day-2026-10-06'));
    expect(view.onOpenDay).toHaveBeenCalledWith('2026-10-06');
    expect(view.queryByTestId('home-week-day-2026-10-11')).toBeNull();
  });

  it('each row keeps its own unavailable state', () => {
    const view = renderHome({ calories: unavailable(), training: unavailable() });
    expect(view.getByText('No pudimos cargar las calorías de la semana.')).toBeTruthy();
    expect(view.getByText('No pudimos cargar el detalle por día.')).toBeTruthy();
    expect(within(view.getByTestId('home-week-training')).getByText('3')).toBeTruthy();
  });

  it('a user who never trained sees a greyed EJEMPLO week', () => {
    const view = renderHome({ training: ready({ weekStart: WEEK, everTrained: false, sessions: [] }) });
    expect(view.getByText('EJEMPLO')).toBeTruthy();
    expect(view.getByText('Con tu primer entrenamiento, esto pasa a ser tuyo.')).toBeTruthy();
    expect(view.queryByTestId('home-week-calories')).toBeNull();
  });
});

describe('Registrar', () => {
  it('four circles: Peso, the first two active metrics and Más, with today\'s state and a check on what is logged', () => {
    const view = renderHome();
    const register = view.getByTestId('home-register');
    expect(within(register).getAllByRole('button').map(button => button.props.accessibilityLabel))
      .toEqual(['Peso, Cargar', 'Sueño, 7,5', 'Energía, Cargar', 'Más, Métricas']);
    expect(within(register).getByRole('button', { name: 'Sueño, 7,5' }).props.accessibilityState).toEqual({ checked: true });
    expect(within(register).getByRole('button', { name: 'Energía, Cargar' }).props.accessibilityState).toEqual({ checked: false });
    fireEvent.press(within(register).getByRole('button', { name: 'Peso, Cargar' }));
    fireEvent.press(within(register).getByRole('button', { name: 'Sueño, 7,5' }));
    fireEvent.press(within(register).getByRole('button', { name: 'Más, Métricas' }));
    expect(view.onRegister.mock.calls).toEqual([[{ kind: 'weight' }], [{ kind: 'metric', metricId: 'm-sleep' }], [{ kind: 'more' }]]);
  });

  it('a weight logged today is checked; its value only lives in Progreso', () => {
    const day = todayDay();
    day.body.weight = { status: 'ok', data: { date: TODAY, weightKg: 80.4 } as never };
    const weight = within(renderHome({ today: ready(day) }).getByTestId('home-register')).getByTestId('home-register-weight');
    expect(weight.props.accessibilityLabel).toBe('Peso, Cargado');
    expect(weight.props.accessibilityState).toEqual({ checked: true });
  });

  it('an unavailable, stale, previous-day or failed weight read never claims "Cargar" nor a check', () => {
    const oldDay = todayDay(); oldDay.date = '2026-10-09';
    const failedWeight = todayDay(); failedWeight.body.weight = { status: 'unavailable' };
    for (const today of [unavailable<HistoryDay>(), unavailable(todayDay()), ready(oldDay), ready(failedWeight)]) {
      const view = renderHome({ today });
      const weight = within(view.getByTestId('home-register')).getByTestId('home-register-weight');
      expect(weight.props.accessibilityLabel).toBe('Peso, —');
      expect(weight.props.accessibilityState).toEqual({ checked: false });
      view.unmount();
    }
  });
});

describe('Screen states', () => {
  it('loading: blocks that need Home show their own skeleton; independent reads still render', () => {
    const view = renderHome({ home: loading() });
    expect(view.getByTestId('home-nutrition-loading')).toBeTruthy();
    expect(view.getByText('SÁBADO 10 DE OCTUBRE')).toBeTruthy();
    expect(view.getByTestId('home-register')).toBeTruthy();
  });

  it('offline with a cached read: notice with its age and retry', () => {
    const view = renderHome({ home: unavailable(home()) });
    expect(view.getByText('Uy, no pudimos actualizar')).toBeTruthy();
    expect(view.getByText('Te mostramos lo último que cargó, de hace 2 h. Tus datos están guardados.')).toBeTruthy();
    fireEvent.press(within(view.getByTestId('home-offline')).getByRole('button', { name: 'Reintentar' }));
    expect(view.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('progress closes Home and links to the existing overview', () => {
    const view = renderHome();
    expect(view.getByTestId('home-progress')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Ver todo' }));
    expect(view.onNavigate).toHaveBeenCalledWith('progress');
  });

  it('cards have no border', () => {
    const style = StyleSheet.flatten(renderHome().getByTestId('home-nutrition').props.style);
    expect(style.borderWidth ?? 0).toBe(0);
  });

  it.each(['dark', 'light', 'system'] as const)('renders in %s mode', theme => {
    expect(renderHome({}, theme).getByTestId('real-home-dashboard')).toBeTruthy();
  });
});
