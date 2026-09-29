import type { PropsWithChildren } from 'react';
import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import TrainLayout from '../../app/(tabs)/train/_layout';

const mockScreen = jest.fn();

jest.mock('expo-router', () => ({
  Stack: Object.assign(
    ({ children }: PropsWithChildren) => children,
    { Screen: ({ name, options }: { name: string; options: object }) => {
      mockScreen(name, options);
      return null;
    } },
  ),
}));
jest.mock('@/navigation/use-stack-screen-options', () => ({
  useStackScreenOptions: () => ({}),
}));

describe('Training stack', () => {
  it('keeps the native session back header as Entrenar, distinct from the content title', () => {
    render(<TrainLayout />);
    expect(mockScreen).toHaveBeenCalledWith('session/[id]', { title: 'Entrenar' });
  });
});
