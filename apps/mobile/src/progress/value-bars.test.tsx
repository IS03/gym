import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { OwnlevelThemeProvider } from '@/design-system';

import { barGeometry, ValueBars } from './value-bars';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

describe('ValueBars: faithful representation', () => {
  it('0 draws no bar; missing is a gap, not 0', () => {
    expect(barGeometry([0, null, 10])).toEqual([{ kind: 'zero' }, { kind: 'missing' }, { kind: 'bar', start: 0, width: 1 }]);
  });

  it('min = max draws proportional bars from 0, never a fake difference', () => {
    expect(barGeometry([80, 80])).toEqual([{ kind: 'bar', start: 0, width: 1 }, { kind: 'bar', start: 0, width: 1 }]);
    expect(barGeometry([0, 0])).toEqual([{ kind: 'zero' }, { kind: 'zero' }]);
    expect(barGeometry([null, null])).toEqual([{ kind: 'missing' }, { kind: 'missing' }]);
  });

  it('lengths are proportional with no minimum visual magnitude', () => {
    const [small, big] = barGeometry([1, 100]);
    expect(small).toEqual({ kind: 'bar', start: 0, width: 0.01 });
    expect(big).toEqual({ kind: 'bar', start: 0, width: 1 });
  });

  it('negatives extend left of the zero line', () => {
    expect(barGeometry([-50, 0, 150])).toEqual([
      { kind: 'bar', start: 0, width: 0.25 },
      { kind: 'zero' },
      { kind: 'bar', start: 0.25, width: 0.75 },
    ]);
  });

  it('renders bars only for non-zero known values, keeping the text for every row', () => {
    const view = render(<OwnlevelThemeProvider initialMode="light"><ValueBars testID="chart" bars={[
      { key: 'a', label: 'Lun', value: 0, text: '0 kg' },
      { key: 'b', label: 'Mar', value: null, text: 'Sin dato' },
      { key: 'c', label: 'Mié', value: 12, text: '12 kg' },
    ]} /></OwnlevelThemeProvider>);
    expect(view.queryByTestId('chart-bar-a')).toBeNull();
    expect(view.queryByTestId('chart-bar-b')).toBeNull();
    expect(view.getByTestId('chart-bar-c')).toBeTruthy();
    expect(view.getByText('0 kg')).toBeTruthy();
    expect(view.getByText('Sin dato')).toBeTruthy();
  });
});
