import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';

import { OwnlevelThemeProvider } from '@/design-system';

import { NewSessionSheet } from './new-session-sheet.ios';
import type { NewSessionSheetProps } from './new-session-sheet.types';

type MockProps = { children?: ReactNode; modifiers?: Record<string, unknown>[]; onPress?: () => void; role?: string; value?: string; isPresented?: boolean };
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const marker = (key: string) => (value?: unknown) => ({ [key]: value });
  return {
    accessibilityAddTraits: marker('traits'), accessibilityLabel: marker('label'), background: marker('bg'), containerBackground: marker('containerBg'), contentShape: marker('shape'), font: marker('font'),
    foregroundStyle: marker('fg'), frame: marker('frame'), lineLimit: marker('lines'), navigationBarTitleDisplayMode: marker('titleMode'),
    navigationTitle: marker('title'), onGeometryChange: marker('onGeometry'), onTapGesture: marker('onTap'), opacity: marker('opacity'), padding: marker('padding'),
    presentationDetents: marker('detents'), presentationDragIndicator: marker('grabber'), shapes: { capsule: () => ({}), circle: () => ({}), rectangle: () => ({}), roundedRectangle: () => ({}) },
  };
});
// SwiftUI views are native: each renders its children; a tap modifier becomes a pressable with its label.
jest.mock('@expo/ui/swift-ui', () => {
  const { Pressable, Text: RNText, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const find = (modifiers: MockProps['modifiers'], key: string) => modifiers?.find(modifier => key in modifier)?.[key];
  const container = ({ children, modifiers }: MockProps) => {
    const onTap = find(modifiers, 'onTap') as (() => void) | undefined;
    const label = find(modifiers, 'label') as string | undefined;
    const title = find(modifiers, 'title') as string | undefined;
    const body = <>{title ? <RNText accessibilityRole="header">{title}</RNText> : null}{children}</>;
    return onTap ? <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onTap}>{body}</Pressable> : <View accessibilityLabel={label}>{body}</View>;
  };
  const Toolbar = Object.assign(container, { Content: container });
  return {
    BottomSheet: ({ children, isPresented }: MockProps) => (isPresented ? <View testID="native-sheet">{children}</View> : null),
    Button: ({ onPress, role }: MockProps) => <Pressable accessibilityLabel={role === 'close' ? 'Cerrar' : undefined} accessibilityRole="button" onPress={onPress} />,
    Group: container, HStack: container, Host: container, Image: () => null, NavigationDestination: ({ children, value }: MockProps) => <View testID={`destination-${value}`}>{children}</View>,
    NavigationLink: ({ children, value }: MockProps) => <View testID={`link-${value}`}>{children}</View>,
    NavigationStack: container, ScrollView: container, Spacer: () => null, Text: ({ children, modifiers }: MockProps) => container({ children: <RNText>{children}</RNText>, modifiers }),
    Toolbar, ToolbarItem: container, VStack: container, ZStack: container,
  };
});

const push = { color: null, exerciseCount: 8, id: 'r1', lastDone: 'ayer', name: 'PUSH', setCount: 24 };
function renderSheet(overrides: Partial<NewSessionSheetProps> = {}) {
  const handlers = { onClose: jest.fn(), onCreateRoutine: jest.fn(), onDismissed: jest.fn(), onFree: jest.fn(), onPage: jest.fn(), onPickRoutine: jest.fn() };
  const props: NewSessionSheetProps = {
    ...handlers, open: true, page: 'start', recommendation: { doneToday: false, routine: push, status: 'ok', weekday: 'viernes' }, routines: { items: [push], status: 'ok' }, ...overrides,
  };
  const view = render(<OwnlevelThemeProvider initialMode="light"><NewSessionSheet {...props} /></OwnlevelThemeProvider>);
  return { ...view, ...handlers };
}

describe('New session sheet (iOS, SwiftUI)', () => {
  it('native sheet with titles, the system close button, the recommended routine and free session', () => {
    const view = renderSheet();
    expect(view.getByRole('header', { name: 'Nueva sesión' })).toBeTruthy();
    expect(view.getByRole('header', { name: 'Elegir rutina' })).toBeTruthy(); // the pushed page (NavigationDestination)
    fireEvent.press(view.getByRole('button', { name: 'Recomendada para viernes: PUSH. Más repetida. 8 ejercicios · 24 series' }));
    expect(view.onPickRoutine).toHaveBeenCalledWith('r1');
    fireEvent.press(view.getByRole('button', { name: 'Sesión libre, Empezar vacío e ir sumando ejercicios' }));
    expect(view.onFree).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(view.onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByRole('button', { name: 'Elegir rutina, Todas tus rutinas guardadas' }));
    expect(view.onPage).toHaveBeenCalledWith('routines');
  });

  it('a recommendation already done today says so', () => {
    const view = renderSheet({ recommendation: { doneToday: true, routine: push, status: 'ok', weekday: 'viernes' } });
    expect(view.getByRole('button', { name: 'Recomendada para viernes: PUSH. Ya la hiciste hoy. 8 ejercicios · 24 series' })).toBeTruthy();
  });

  it('"Elegir rutina" lists routines with when they were last done, without the recommendation', () => {
    const view = renderSheet({ page: 'routines' });
    const list = view.getByTestId('destination-routines');
    expect(list).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'PUSH, 8 ejercicios · 24 series, ayer' }));
    expect(view.onPickRoutine).toHaveBeenCalledWith('r1');
  });

  it('no recommendation: only the two options; no routines: create one', () => {
    const view = renderSheet({ recommendation: { status: 'none' }, routines: { items: [], status: 'ok' } });
    expect(view.queryByRole('button', { name: /Recomendada/ })).toBeNull();
    expect(view.queryByText('Elegí cómo empezar.')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Crear rutina, Todavía no tenés rutinas.' }));
    expect(view.onCreateRoutine).toHaveBeenCalledTimes(1);
  });
});
