import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import type { QuickOption } from '@/api/nutrition-quick';
import { OwnlevelThemeProvider } from '@/design-system';

import { HomeAddMenu } from './home-add-menu.ios';

// SwiftUI views are native; here each one renders its label/children so the menu tree can be checked.
jest.mock('@expo/ui/swift-ui', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,
    Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Image: () => null,
    Menu: ({ children, label }: { children: React.ReactNode; label: React.ReactNode }) => <View testID="native-menu">{label}{children}</View>,
    Section: ({ children, title }: { children: React.ReactNode; title: string }) => <View><Text>{title}</Text>{children}</View>,
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  accessibilityLabel: (label: string) => ({ label }), background: () => ({}), frame: () => ({}), shapes: { circle: () => ({}) },
}));

const option = (id: string, name: string): QuickOption => ({
  source: { kind: 'suggestion', id, version: 'a'.repeat(64) }, name, description: null, templateType: null, items: [],
  calories: 1, proteinG: null, carbsG: null, fatG: null, useCount: 3, lastUsedDate: '2026-10-09',
});

describe('Nutrition "+" native menu (iOS)', () => {
  it('lists Comida manual, Buscar alimento, the Habituales section and Ver todas, each calling its flow', () => {
    const handlers = { onAll: jest.fn(), onFood: jest.fn(), onHabitual: jest.fn(), onManual: jest.fn() };
    const habituals = [option('00000000-0000-4000-8000-000000000001', 'YOGURT CASERO'), option('00000000-0000-4000-8000-000000000002', 'Batido')];
    const view = render(<OwnlevelThemeProvider initialMode="light"><HomeAddMenu habituals={habituals} {...handlers} /></OwnlevelThemeProvider>);
    expect(view.getByText('Habituales')).toBeTruthy();
    fireEvent.press(view.getByText('Comida manual'));
    fireEvent.press(view.getByText('Buscar alimento'));
    fireEvent.press(view.getByText('Batido'));
    fireEvent.press(view.getByText('Ver todas'));
    expect(handlers.onManual).toHaveBeenCalledTimes(1);
    expect(handlers.onFood).toHaveBeenCalledTimes(1);
    expect(handlers.onHabitual).toHaveBeenCalledWith(habituals[1]);
    expect(handlers.onAll).toHaveBeenCalledTimes(1);
  });
});
