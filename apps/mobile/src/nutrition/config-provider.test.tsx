import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileApiClient } from '@/api/client';
import type { ConfigIntent } from '@/api/nutrition-config';
import { OwnlevelThemeProvider } from '@/design-system';
import { NutritionConfigurationProvider, useNutritionConfiguration } from './config-provider';
import { configFixture } from './config-fixture.test-helper';
import { nutritionFixture } from './day-fixture.test-helper';

const mockRead = jest.fn<MobileApiClient['read']>();
const mockRequest = jest.fn<MobileApiClient['request']>();
const mockClient = { read: mockRead, request: mockRequest };
let mockUser: string | null = 'owner';
jest.mock('@/api', () => ({ useMobileApi: () => ({ client: mockClient }) }));
jest.mock('@/auth', () => ({ useMobileAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const ok = <T,>(data: T) => ({ status: 'ok' as const, data, meta });
const unavailable = { status: 'unavailable' as const, reason: 'network' as const, meta: { ...meta, httpStatus: null, outcome: 'unavailable' as const } };
const receipt = (i: ConfigIntent) => ok({ status: 'confirmed' as const, operation: i.operation, date: i.date, version: 'b'.repeat(64), weightRecorded: true });
type Shared = ReturnType<typeof useNutritionConfiguration>;
const probes: Record<string, Shared> = {};
const capture = (id: string, shared: Shared) => { probes[id] = shared; };
const confirmed = jest.fn();
function Probe({ id, onConfirmed }: { id: string; onConfirmed?: () => void }) {
  const shared = useNutritionConfiguration(onConfirmed);
  useEffect(() => { capture(id, shared); });
  return <Text testID={`${id}-state`}>{shared ? `${shared.state.phase}:${shared.state.intent?.intent.idempotencyKey ?? 'none'}` : 'none'}</Text>;
}
// Nutrition Day and Settings both consume the provider, as in the app.
const element = () => <OwnlevelThemeProvider initialMode="light"><NutritionConfigurationProvider>
  <Probe id="nutrition" onConfirmed={confirmed} /><Probe id="settings" />
</NutritionConfigurationProvider></OwnlevelThemeProvider>;
const text = (view: ReturnType<typeof render>, id: string) => view.getByTestId(`${id}-state`).props.children as string;
async function editWeightFromSettings(view: ReturnType<typeof render>) {
  await waitFor(() => expect(text(view, 'settings')).toBe('idle:none'));
  act(() => { probes.settings!.controller.open('physical'); });
  await view.findByTestId('nutrition-config-editor');
  await waitFor(() => expect(probes.settings!.state.operation).toBe('physical'));
  act(() => { probes.settings!.controller.change('weightKg', '81,5'); });
}

describe('Shared nutrition configuration provider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear(); mockUser = 'owner'; confirmed.mockReset(); mockRequest.mockReset(); mockRead.mockReset();
    mockRead.mockImplementation(async options => (options.path.includes('/nutrition/days/')
      ? ok(nutritionFixture(configFixture.today)) : ok(configFixture)) as never);
  });

  it('one controller instance per user, one hosted editor for every consumer', async () => {
    const view = render(element());
    await waitFor(() => expect(text(view, 'nutrition')).toBe('idle:none'));
    expect(probes.nutrition!.controller).toBe(probes.settings!.controller);
    act(() => { probes.settings!.controller.open('physical'); });
    expect(await view.findAllByTestId('nutrition-config-editor')).toHaveLength(1);
    await view.findByText('Datos físicos');
  });

  it('pending from Settings is visible in Nutrition; an uncertain result is recovered once from Nutrition', async () => {
    let resolve!: (value: unknown) => void;
    mockRequest.mockImplementationOnce(() => new Promise(r => { resolve = r; }) as never);
    const view = render(element());
    await editWeightFromSettings(view);
    act(() => { void probes.settings!.controller.save(); });
    await waitFor(() => expect(text(view, 'nutrition')).toMatch(/^pending:config:/));
    expect(text(view, 'nutrition')).toBe(text(view, 'settings'));
    const key = probes.nutrition!.state.intent!.intent.idempotencyKey;
    await act(async () => { resolve(unavailable); });
    await waitFor(() => expect(text(view, 'nutrition')).toBe(`uncertain:${key}`));
    expect(text(view, 'settings')).toBe(`uncertain:${key}`);
    // Neither consumer can start another write while the intent is unresolved.
    await act(async () => { await probes.settings!.controller.save(); await probes.nutrition!.controller.save(); });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(probes.settings!.state.intent?.intent.idempotencyKey).toBe(key);
    mockRequest.mockImplementationOnce(async options => receipt(options.body as ConfigIntent) as never);
    await act(async () => { await probes.nutrition!.controller.recover(); });
    await waitFor(() => expect(text(view, 'settings')).toBe('idle:none'));
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect((mockRequest.mock.calls[1][0].body as ConfigIntent).idempotencyKey).toBe(key);
    expect(mockRequest.mock.calls[1][0].path).toBe('/api/mobile/v1/profile/physical');
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(probes.settings!.state.message).toBe('Datos guardados. El peso quedó registrado para hoy.');
  });

  it('an uncertain intent from Nutrition is the one Settings sees (also after restart)', async () => {
    mockRequest.mockResolvedValueOnce(unavailable as never);
    let view = render(element());
    await waitFor(() => expect(text(view, 'nutrition')).toBe('idle:none'));
    act(() => { probes.nutrition!.controller.open(); });
    await waitFor(() => expect(probes.nutrition!.state.config).not.toBeNull());
    act(() => { probes.nutrition!.controller.begin('energy'); });
    await act(async () => { await probes.nutrition!.controller.save(); });
    const key = probes.nutrition!.state.intent!.intent.idempotencyKey;
    expect(text(view, 'settings')).toBe(`uncertain:${key}`);
    view.unmount();
    view = render(element());
    await waitFor(() => expect(text(view, 'settings')).toBe(`uncertain:${key}`));
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('a conflict keeps the draft for both consumers and refreshes server truth', async () => {
    mockRequest.mockResolvedValueOnce({ status: 'conflict', code: 'PHYSICAL_CHANGED', message: 'Los datos cambiaron.', meta: { ...meta, outcome: 'conflict' } } as never);
    const view = render(element());
    await editWeightFromSettings(view);
    await act(async () => { await probes.settings!.controller.save(); });
    expect(text(view, 'nutrition')).toBe('conflict:none');
    expect(probes.nutrition!.state.draft?.weightKg).toBe('81,5');
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('user switch: the new user gets its own instance; the previous intent stays only in its namespace', async () => {
    mockRequest.mockResolvedValueOnce(unavailable as never);
    const view = render(element());
    await editWeightFromSettings(view);
    await act(async () => { await probes.settings!.controller.save(); });
    const ownerController = probes.settings!.controller, key = probes.settings!.state.intent!.intent.idempotencyKey;
    mockUser = 'second-user'; view.rerender(element());
    await waitFor(() => expect(text(view, 'settings')).toBe('idle:none'));
    expect(probes.settings!.controller).not.toBe(ownerController);
    expect(await AsyncStorage.getItem('ownlevel.nutrition.config.v1.owner')).toContain(key);
    expect(await AsyncStorage.getItem('ownlevel.nutrition.config.v1.second-user')).toBeNull();
    mockUser = null; view.rerender(element());
    await waitFor(() => expect(text(view, 'settings')).toBe('none'));
    expect(view.queryByTestId('nutrition-config-editor')).toBeNull();
    mockUser = 'owner'; view.rerender(element());
    await waitFor(() => expect(text(view, 'settings')).toBe(`uncertain:${key}`));
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
