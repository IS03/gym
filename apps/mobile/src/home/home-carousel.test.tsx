import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText, OwnlevelThemeProvider } from '@/design-system';

import { HomeCarousel } from './home-carousel';

let mockReduced = false;
jest.mock('@/design-system', () => ({ ...jest.requireActual<object>('@/design-system'), useReduceMotion: () => mockReduced }));

function carousel() {
  return render(<OwnlevelThemeProvider initialMode="light"><HomeCarousel pages={[
    { label: 'Entrenos', content: <AppText>Resumen de entrenos</AppText> },
    { label: 'Nutrición', content: <AppText>Promedios</AppText> },
    { label: 'Por día', content: <AppText>Detalle de días</AppText> },
  ]} /></OwnlevelThemeProvider>);
}

describe('Home weekly carousel', () => {
  it('explicit controls select the same pages and hide offscreen content from accessibility', () => {
    const view = carousel();
    expect(view.getByText('Resumen de entrenos')).toBeTruthy();
    expect(view.queryByText('Promedios')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Ver nutrición de esta semana' }));
    expect(view.getByText('Promedios')).toBeTruthy();
    expect(view.queryByText('Resumen de entrenos')).toBeNull();
    expect(view.getByTestId('home-week-page-1').props.accessibilityState).toEqual({ selected: true });
    expect(StyleSheet.flatten(view.getByTestId('home-week-page-1').props.style).minHeight).toBe(44);
  });

  it('swipes select a page, clamp overscroll and adapt height to its content', () => {
    const view = carousel();
    fireEvent(view.getByTestId('home-week-carousel'), 'layout', { nativeEvent: { layout: { width: 360 } } });
    fireEvent(view.getByTestId('home-week-content-0'), 'layout', { nativeEvent: { layout: { height: 120 } } });
    fireEvent(view.getByTestId('home-week-content-2', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { height: 500 } } });
    expect(StyleSheet.flatten(view.getByTestId('home-week-pager').props.style).height).toBe(120);
    fireEvent(view.getByTestId('home-week-pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 725 } } });
    expect(view.getByText('Detalle de días')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('home-week-pager').props.style).height).toBe(500);
    fireEvent(view.getByTestId('home-week-pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: -80 } } });
    expect(view.getByText('Resumen de entrenos')).toBeTruthy();
  });

  it('width changes keep the selected page and remeasure content (rotation / Dynamic Type)', () => {
    const view = carousel();
    fireEvent.press(view.getByTestId('home-week-page-2'));
    fireEvent(view.getByTestId('home-week-carousel'), 'layout', { nativeEvent: { layout: { width: 600 } } });
    expect(view.getByTestId('home-week-page-2').props.accessibilityState).toEqual({ selected: true });
    expect(StyleSheet.flatten(view.getByTestId('home-week-content-2').props.style).width).toBe(600);
    fireEvent(view.getByTestId('home-week-content-2'), 'layout', { nativeEvent: { layout: { height: 350 } } });
    expect(StyleSheet.flatten(view.getByTestId('home-week-pager').props.style).height).toBe(350);
  });

  it('Reduce Motion disables animated jumps, not access to pages', () => {
    const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo');
    mockReduced = true;
    const view = carousel();
    fireEvent.press(view.getByTestId('home-week-page-1'));
    expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ animated: false }));
    expect(view.getByText('Promedios')).toBeTruthy();
    mockReduced = false;
    scroll.mockRestore();
  });
});
