import { act, fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';

import type { HistoryDay } from '@/api/history';
import { OwnlevelThemeProvider } from '@/design-system';

import { HomeRegister } from './home-register';

let mockSupported = true;
let mockReduced = false;
jest.mock('@/design-system', () => ({ ...jest.requireActual<object>('@/design-system'), useReduceMotion: () => mockReduced }));
jest.mock('expo-glass-effect', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { GlassView: View, isGlassEffectAPIAvailable: () => mockSupported, isLiquidGlassAvailable: () => mockSupported };
});
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const day = { date: '2026-10-08', metrics: { status: 'ok', data: { metrics: Array.from({ length: 6 }, (_, index) => ({
  id: `m${index}`, label: `Métrica ${index}`, systemKey: null, unit: null, valueType: 'decimal', target: null,
  value: index === 0 ? 0 : null, isActive: true, updatedAt: null,
})) } } } as HistoryDay;

async function metrics() {
  const onRegister = jest.fn();
  const view = render(<OwnlevelThemeProvider initialMode="dark"><HomeRegister date={day.date} onRegister={onRegister}
    today={{ status: 'ready', confirmedAt: 1, data: day }} /></OwnlevelThemeProvider>);
  await act(async () => { await Promise.resolve(); });
  return { ...view, onRegister };
}

describe('Home metric controls', () => {
  beforeEach(() => { jest.restoreAllMocks(); mockSupported = true; mockReduced = false; });

  it('all six metrics remain reachable, zero is logged, and Más is fixed outside the scroller', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    const view = await metrics();
    expect(view.getAllByTestId(/home-register-metric-m\d$/)).toHaveLength(6);
    expect(view.getByRole('button', { name: 'Métrica 0, 0' }).props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(view.getByTestId('home-register-metric-m5'));
    expect(view.onRegister).toHaveBeenCalledWith({ kind: 'metric', metricId: 'm5' });
    fireEvent.press(view.getByTestId('home-register-more'));
    expect(view.onRegister).toHaveBeenCalledWith({ kind: 'more' });
    expect(view.getByTestId('home-register-scroll').props.horizontal).toBe(true);
    expect(view.getByTestId('home-register-fixed-more')).toBeTruthy();
    expect(view.getByTestId('home-register-more-glass').props.colorScheme).toBe('dark');
  });

  it('Reduce Transparency uses solid controls and responds to changes while open', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    const listener = jest.spyOn(AccessibilityInfo, 'addEventListener');
    const view = await metrics();
    expect(view.queryByTestId('home-register-more-glass')).toBeNull();
    const calls = listener.mock.calls as unknown as [string, (value: boolean) => void][];
    const callback = calls.find(call => call[0] === 'reduceTransparencyChanged')![1];
    act(() => callback(false));
    expect(view.getByTestId('home-register-more-glass')).toBeTruthy();
    act(() => callback(true));
    expect(view.queryByTestId('home-register-more-glass')).toBeNull();
  });

  it('native expansion has top headroom and is not combined with a second press scale', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    const view = await metrics();
    const scroller = view.getByTestId('home-register-scroll');
    expect(StyleSheet.flatten(scroller.props.contentContainerStyle).paddingTop).toBe(20);
    expect(scroller.props.removeClippedSubviews).toBe(false);
    expect(StyleSheet.flatten(view.getByTestId('home-register-fixed-more').props.style).paddingTop).toBe(20);
    expect(view.getByTestId('home-register-metric-m0-glass').props.isInteractive).toBe(true);
    fireEvent(view.getByTestId('home-register-metric-m0'), 'pressIn');
    expect(StyleSheet.flatten(view.getByTestId('home-register-metric-m0').props.style).transform).toBeUndefined();
  });

  it('Reduce Motion disables native expansion while retaining the metric action', async () => {
    mockReduced = true;
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    const view = await metrics();
    expect(view.getByTestId('home-register-metric-m0-glass').props.isInteractive).toBe(false);
    fireEvent.press(view.getByTestId('home-register-metric-m0'));
    expect(view.onRegister).toHaveBeenCalledWith({ kind: 'metric', metricId: 'm0' });
  });

  it('unsupported systems and Android never mount native glass', async () => {
    mockSupported = false;
    const view = await metrics();
    expect(view.queryByTestId('home-register-more-glass')).toBeNull();
    view.unmount();
    mockSupported = true;
    jest.replaceProperty(Platform, 'OS', 'android');
    const android = await metrics();
    expect(android.queryByTestId('home-register-more-glass')).toBeNull();
  });

  it('fewer than three active metrics share the available width with Más', async () => {
    mockSupported = false;
    const view = render(<OwnlevelThemeProvider initialMode="light"><HomeRegister date={day.date} onRegister={() => undefined}
      today={{ status: 'ready', confirmedAt: 1, data: { ...day, metrics: { status: 'ok', data: { metrics: day.metrics.status === 'ok' ? day.metrics.data.metrics.slice(0, 2) : [] } } } }} /></OwnlevelThemeProvider>);
    const row = view.getByTestId('home-register-fixed-more').parent!;
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 360 } } });
    expect(StyleSheet.flatten(view.getByTestId('home-register-more').props.style).width).toBe(120);
    expect(StyleSheet.flatten(view.getByTestId('home-register-metric-m0').props.style).width).toBe(120);
  });

  it('a failed preference read stays solid rather than assuming transparency is allowed', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockRejectedValue(new Error('unavailable'));
    const view = await metrics();
    expect(view.queryByTestId('home-register-more-glass')).toBeNull();
  });
});
