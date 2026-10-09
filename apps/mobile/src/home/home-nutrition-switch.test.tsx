import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Animated, StyleSheet, Text } from 'react-native';

import { OwnlevelThemeProvider } from '@/design-system';
import { NutritionSwitchText, nutritionReelSlots } from './home-nutrition-switch';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

function transition({ numeric = true, reduced = false, remaining = false, phase = 0.5, theme = 'light' as 'light' | 'dark' } = {}) {
  const progress = new Animated.Value(phase);
  return <OwnlevelThemeProvider initialMode={theme}><NutritionSwitchText alternate="752" direction={-1} numeric={numeric}
    progress={progress} reduced={reduced} remaining={remaining} testID="value" value="1.348" variant="largeTitle" /></OwnlevelThemeProvider>;
}

describe('Nutrition value transition', () => {
  it.each(['light', 'dark'] as const)('both modes have an explicit readable theme color in %s, without waiting for layout', theme => {
    const color = theme === 'dark' ? '#F4F4F5' : '#18181B';
    const view = render(transition({ theme, phase: 0 }));
    const old = view.getByTestId('value-slot-4-consumed', { includeHiddenElements: true });
    expect(StyleSheet.flatten(old.findByType(Text).props.style).color).toBe(color);
    expect(StyleSheet.flatten(old.props.style).opacity).toBe(1);
    expect(view.getByTestId('value').props.accessibilityLabel).toBe('1.348');
    expect(view.getByTestId('value').props.onLayout).toBeUndefined();
    view.rerender(transition({ theme, phase: 1, remaining: true }));
    const next = view.getByTestId('value-slot-4-remaining', { includeHiddenElements: true });
    expect(StyleSheet.flatten(next.findByType(Text).props.style).color).toBe(color);
    expect(StyleSheet.flatten(next.props.style)).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] });
    expect(view.getByTestId('value').props.accessibilityLabel).toBe('752');
  });

  it('rolls individual digit places, staggered from units, while separators never slide', () => {
    const view = render(transition());
    const old = StyleSheet.flatten(view.getByTestId('value-slot-4-consumed', { includeHiddenElements: true }).props.style);
    const next = StyleSheet.flatten(view.getByTestId('value-slot-4-remaining', { includeHiddenElements: true }).props.style);
    expect(old.transform[0].translateY).toBeGreaterThan(0);
    expect(next.transform[0].translateY).toBeLessThan(0);
    expect(old.opacity).toBeGreaterThan(0);
    expect(next.opacity).toBeGreaterThan(0);
    const hundreds = StyleSheet.flatten(view.getByTestId('value-slot-2-consumed', { includeHiddenElements: true }).props.style);
    expect(hundreds.transform[0].translateY).toBeLessThan(old.transform[0].translateY);
    expect(StyleSheet.flatten(view.getByTestId('value-slot-1-consumed', { includeHiddenElements: true }).props.style).transform).toEqual([]);
    expect(view.getByTestId('value').props.accessibilityLabel).toBe('1.348');
    view.rerender(transition({ remaining: true }));
    expect(view.getByTestId('value').props.accessibilityLabel).toBe('752');
    expect(StyleSheet.flatten(view.getByTestId('value-slot-4', { includeHiddenElements: true }).props.style).overflow).toBe('hidden');
  });

  it('Reduce Motion only crossfades: no number roll or label reveal movement', () => {
    const view = render(transition({ reduced: true }));
    expect(StyleSheet.flatten(view.getByTestId('value-consumed').props.style).transform).toEqual([]);
    expect(StyleSheet.flatten(view.getByTestId('value-remaining', { includeHiddenElements: true }).props.style).transform).toEqual([]);
    view.rerender(transition({ numeric: false, reduced: true, remaining: true }));
    expect(StyleSheet.flatten(view.getByTestId('value-remaining').props.style).transform).toEqual([]);
  });

  it('rapid reversals reuse digit layers and expose only the final total to accessibility', () => {
    const view = render(transition());
    view.rerender(transition({ remaining: true }));
    view.rerender(transition());
    view.rerender(transition({ remaining: true }));
    expect(view.getByTestId('value').props.accessibilityLabel).toBe('752');
    expect(view.getAllByTestId(/value-slot-4-(consumed|remaining)/, { includeHiddenElements: true })).toHaveLength(2);
  });

  it('aligns differing lengths, zero, thousands and decimal separators; keeps goals and units outside reels', () => {
    expect(nutritionReelSlots('108 / 130 g', '22 / 130 g')).toEqual({ suffix: ' / 130 g', slots: [
      { old: '1', next: ' ' }, { old: '0', next: '2' }, { old: '8', next: '2' },
    ] });
    expect(nutritionReelSlots('1.348', '0')?.slots.at(-1)).toEqual({ old: '8', next: '0' });
    expect(nutritionReelSlots('12,5', '22,5')?.slots).toEqual([
      { old: '1', next: '2' }, { old: '2', next: '2' }, { old: ',', next: ',' }, { old: '5', next: '5' },
    ]);
    expect(nutritionReelSlots('—', '22')).toBeNull();
    expect(nutritionReelSlots('22 / 130 g', '22 / 160 g')).toBeNull();
  });

  it('renders the unchanged target once, without movement, and rolls upward for an increasing value', () => {
    const view = render(<OwnlevelThemeProvider initialMode="dark"><NutritionSwitchText value="108 / 130 g" alternate="122 / 130 g"
      numeric direction={1} progress={new Animated.Value(0.5)} reduced={false} remaining={true} testID="protein" variant="headline" /></OwnlevelThemeProvider>);
    expect(view.getByTestId('protein').props.accessibilityLabel).toBe('122 / 130 g');
    const suffix = view.getByTestId('protein-suffix', { includeHiddenElements: true });
    expect(suffix.props.children).toBe(' / 130 g');
    expect(StyleSheet.flatten(suffix.props.style).transform).toBeUndefined();
    expect(StyleSheet.flatten(view.getByTestId('protein-slot-2-consumed', { includeHiddenElements: true }).props.style).transform[0].translateY).toBeLessThan(0);
  });

  it('uses a full Dynamic Type line for the reel travel without clipping the measured text height', () => {
    mockFontScale = 2;
    const view = render(transition({ phase: 0 }));
    const incoming = view.getByTestId('value-slot-4-remaining', { includeHiddenElements: true });
    expect(StyleSheet.flatten(incoming.props.style).transform).toEqual([{ translateY: -82 }]);
    expect(StyleSheet.flatten(view.getByTestId('value-slot-4', { includeHiddenElements: true }).props.style).height).toBeUndefined();
    mockFontScale = 1;
  });

  it('labels stay full-width during the transition rather than using a zero-width mask', () => {
    const view = render(transition({ numeric: false, remaining: true }));
    expect(StyleSheet.flatten(view.getByTestId('value-remaining').props.style)).toMatchObject({ opacity: 0.5, transform: [{ translateX: 4 }] });
    expect(StyleSheet.flatten(view.getByTestId('value-remaining').props.style).width).toBeUndefined();
  });
});
