import { act, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';

import { useHoldStartConfirmLock, useStartConfirmPointerEvents } from './start-confirm-lock';

function Harness({ open }: { open: boolean }) {
  useHoldStartConfirmLock(open);
  return <Text>{useStartConfirmPointerEvents()}</Text>;
}

describe('Start confirmation touch lock', () => {
  it('screens stop taking touches while a confirmation is open, until the dismissing tap ends', () => {
    jest.useFakeTimers();
    const view = render(<Harness open={false} />);
    expect(view.getByText('auto')).toBeTruthy();
    view.rerender(<Harness open />);
    expect(view.getByText('none')).toBeTruthy();
    view.rerender(<Harness open={false} />);
    expect(view.getByText('none')).toBeTruthy(); // the tap that closed it must not reach the screen
    act(() => { jest.advanceTimersByTime(300); });
    expect(view.getByText('auto')).toBeTruthy();
    jest.useRealTimers();
  });
});
