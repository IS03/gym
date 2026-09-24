import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';

import {
  Button,
  EmptyState,
  ProgressBar,
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
});
