import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { HeaderHeightContext } from 'expo-router/build/react-navigation/elements/Header/HeaderHeightContext';

import {
  Button,
  EmptyState,
  ProgressBar,
  Screen,
  ScrollScreen,
  UnavailableState,
} from './primitives';
import { OwnlevelThemeProvider } from './theme';

function renderWithTheme(node: ReactNode) {
  return render(<OwnlevelThemeProvider initialMode="light">{node}</OwnlevelThemeProvider>);
}

describe('design-system primitives', () => {
  it('exposes an accessible button action', () => {
    const onPress = jest.fn();
    const view = renderWithTheme(<Button label="Continuar" onPress={onPress} />);

    fireEvent.press(view.getByRole('button', { name: 'Continuar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('distinguishes empty from unavailable states', () => {
    const view = renderWithTheme(
      <>
        <EmptyState description="Todavía no hay registros." title="Sin datos" />
        <UnavailableState description="No se pudo consultar." title="No disponible" />
      </>,
    );

    expect(view.getByText('Sin datos')).toBeTruthy();
    expect(view.getByText('No disponible')).toBeTruthy();
  });

  it('exposes progress without relying only on color', () => {
    const view = renderWithTheme(
      <ProgressBar accessibilityLabel="Progreso: 40%" value={40} />,
    );

    expect(view.getByRole('progressbar', { name: 'Progreso: 40%' })).toHaveProp(
      'accessibilityValue',
      { max: 100, min: 0, now: 40 },
    );
  });

  it('shared screens carry the background glow: fixed behind the content, untouchable, same color fading to alpha 0', () => {
    const light = renderWithTheme(<ScrollScreen><Text>contenido</Text></ScrollScreen>);
    const glow = light.getByTestId('screen-glow');
    expect(glow.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(glow.props.style)).toMatchObject({
      position: 'absolute',
      experimental_backgroundImage: 'radial-gradient(ellipse 300px 400px at 105% -4%, rgba(228,222,201,1) 0%, rgba(228,222,201,0.55) 38%, rgba(228,222,201,0) 100%)',
    });
    light.unmount();
    const dark = render(<OwnlevelThemeProvider initialMode="dark"><Screen><Text>contenido</Text></Screen></OwnlevelThemeProvider>);
    expect(StyleSheet.flatten(dark.getByTestId('screen-glow').props.style).experimental_backgroundImage).toContain('rgba(42,39,32,0)');
  });

  it('focused flows can turn the glow off', () => {
    const view = renderWithTheme(<ScrollScreen glow={false}><Text>sesión</Text></ScrollScreen>);
    expect(view.queryByTestId('screen-glow')).toBeNull();
  });

  it('no glow under an opaque native header (it would be cut with a hard edge)', () => {
    const view = renderWithTheme(<HeaderHeightContext.Provider value={96}><ScrollScreen><Text>ajustes</Text></ScrollScreen></HeaderHeightContext.Provider>);
    expect(view.queryByTestId('screen-glow')).toBeNull();
  });
});
