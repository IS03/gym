import { act, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { OwnlevelThemeProvider, useOwnlevelTheme } from './theme';
import { createThemePreferenceStorage, THEME_PREFERENCE_KEY, type ThemePreferenceStorage } from './theme-preference';

function memoryPort(initial?: string) {
  const memory = new Map<string, string>(initial === undefined ? [] : [[THEME_PREFERENCE_KEY, initial]]);
  return { memory, port: {
    getItem: jest.fn(async (k: string) => memory.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { memory.set(k, v); }),
  } };
}
let theme: ReturnType<typeof useOwnlevelTheme>;
const capture = (value: ReturnType<typeof useOwnlevelTheme>) => { theme = value; };
function Probe() {
  const value = useOwnlevelTheme();
  useEffect(() => { capture(value); });
  return <Text testID="mode">{`${value.mode}:${value.resolvedMode}`}</Text>;
}
const app = (persistence?: ThemePreferenceStorage) => <OwnlevelThemeProvider persistence={persistence}><Probe /></OwnlevelThemeProvider>;
const mode = (view: ReturnType<typeof render>) => view.getByTestId('mode').props.children as string;

describe('Theme preference persistence', () => {
  it('defaults to system with nothing saved', async () => {
    const { port } = memoryPort();
    const view = render(app(createThemePreferenceStorage(port)));
    await waitFor(() => expect(port.getItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY));
    expect(mode(view).startsWith('system:')).toBe(true);
  });

  it.each(['light', 'dark'] as const)('applies %s immediately, persists it and restores it after a restart', async next => {
    const { port, memory } = memoryPort();
    const storage = createThemePreferenceStorage(port);
    const view = render(app(storage));
    act(() => theme.setMode(next));
    expect(mode(view)).toBe(`${next}:${next}`);
    await waitFor(() => expect(memory.get(THEME_PREFERENCE_KEY)).toBe(next));
    view.unmount();
    const restarted = render(app(createThemePreferenceStorage(port)));
    await waitFor(() => expect(mode(restarted)).toBe(`${next}:${next}`));
  });

  it('corrupted storage falls back to system', async () => {
    const { port } = memoryPort('purple');
    const view = render(app(createThemePreferenceStorage(port)));
    await waitFor(() => expect(port.getItem).toHaveBeenCalled());
    expect(mode(view).startsWith('system:')).toBe(true);
  });

  it('a read failure keeps the fallback and does not block rendering', async () => {
    const { port } = memoryPort();
    port.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
    const view = render(app(createThemePreferenceStorage(port)));
    expect(mode(view).startsWith('system:')).toBe(true);
    await waitFor(() => expect(port.getItem).toHaveBeenCalled());
    expect(mode(view).startsWith('system:')).toBe(true);
  });

  it('a write failure keeps the chosen theme usable and flags it', async () => {
    const { port } = memoryPort();
    port.setItem.mockRejectedValueOnce(new Error('disk full'));
    const view = render(app(createThemePreferenceStorage(port)));
    act(() => theme.setMode('dark'));
    expect(mode(view)).toBe('dark:dark');
    await waitFor(() => expect(theme.persistenceFailed).toBe(true));
    act(() => theme.setMode('light'));
    await waitFor(() => expect(theme.persistenceFailed).toBe(false));
  });

  it('a late read never overrides a choice made meanwhile', async () => {
    let release!: (v: string | null) => void;
    const port = { getItem: jest.fn(() => new Promise<string | null>(r => { release = r; })), setItem: jest.fn(async () => undefined) };
    const view = render(app(createThemePreferenceStorage(port)));
    act(() => theme.setMode('light'));
    await act(async () => { release('dark'); });
    expect(mode(view)).toBe('light:light');
  });
});
