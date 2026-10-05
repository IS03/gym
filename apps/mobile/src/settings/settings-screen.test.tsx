import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileApiClient } from '@/api/client';
import { OwnlevelThemeProvider } from '@/design-system';
import { NutritionConfigurationProvider } from '@/nutrition/config-provider';
import { configFixture } from '@/nutrition/config-fixture.test-helper';
import { SettingsScreen } from './settings-screen';

const mockRead = jest.fn<MobileApiClient['read']>();
const mockRequest = jest.fn<MobileApiClient['request']>();
const mockClient = { read: mockRead, request: mockRequest };
const mockPush = jest.fn();
const mockSignOut = jest.fn(async () => undefined);
let mockUser = 'owner';
let mockEmail = 'nacho@example.com';
let mockAppEnv = 'development';
let mockAuthState: { status: string; session?: unknown } = { status: 'SIGNED_IN' };
jest.mock('@/api', () => ({ useMobileApi: () => ({ client: mockClient, config: { appEnv: mockAppEnv } }) }));
jest.mock('@/auth', () => ({ useMobileAuth: () => ({
  session: { user: { id: mockUser, email: mockEmail, app_metadata: { provider: 'google' } }, access_token: 'secret-token' },
  signOut: mockSignOut, state: mockAuthState,
}) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => {} }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.0', nativeBuildVersion: '42' }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const v1 = 'a'.repeat(64), v2 = 'b'.repeat(64), v3 = 'c'.repeat(64);
const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const ok = <T,>(data: T) => ({ status: 'ok' as const, data, meta });
let names: Record<string, { displayName: string | null; version: string }>;
const element = () => <OwnlevelThemeProvider initialMode="light"><NutritionConfigurationProvider><SettingsScreen /></NutritionConfigurationProvider></OwnlevelThemeProvider>;

describe('Settings hub', () => {
  beforeEach(async () => {
    await AsyncStorage.clear(); jest.clearAllMocks(); mockUser = 'owner'; mockEmail = 'nacho@example.com'; mockAppEnv = 'development';
    mockAuthState = { status: 'SIGNED_IN' };
    names = { owner: { displayName: 'Nacho', version: v1 }, 'second-user': { displayName: 'Ana', version: v3 } };
    mockRead.mockImplementation(async options => (options.path === '/api/mobile/v1/profile' ? ok(names[mockUser]) : ok(configFixture)) as never);
  });

  it('profile card shows the server name and the session email (never tokens or ids)', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    expect(view.getAllByText('nacho@example.com').length).toBeGreaterThan(0);
    expect(view.queryByText(/secret-token|owner/)).toBeNull();
  });

  it('edits the display name: trimmed PATCH with CAS, then the card shows the reread truth', async () => {
    mockRequest.mockImplementationOnce(async () => { names.owner = { displayName: 'Ignacio', version: v2 }; return ok({ status: 'confirmed', ...names.owner }) as never; });
    const view = render(element());
    fireEvent.press(await view.findByText('Editar nombre'));
    fireEvent.changeText(view.getByLabelText('Cómo querés que te llamemos'), '  Ignacio ');
    await act(async () => { fireEvent.press(view.getByText('Guardar nombre')); });
    await view.findByText('Ignacio');
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH', path: '/api/mobile/v1/profile',
      body: expect.objectContaining({ displayName: 'Ignacio', expectedVersion: v1 }) }));
    expect(view.getByText('Nombre guardado.')).toBeTruthy();
  });

  it('a name changed on Web meanwhile is a conflict: no overwrite, draft kept, server value shown', async () => {
    mockRequest.mockImplementationOnce(async () => { names.owner = { displayName: 'Desde Web', version: v3 };
      return { status: 'conflict', code: 'PROFILE_CHANGED', message: 'Tu nombre cambió desde que abriste el formulario.', meta: { ...meta, outcome: 'conflict' } } as never; });
    const view = render(element());
    fireEvent.press(await view.findByText('Editar nombre'));
    fireEvent.changeText(view.getByLabelText('Cómo querés que te llamemos'), 'Mobile');
    await act(async () => { fireEvent.press(view.getByText('Guardar nombre')); });
    await view.findByText('Valor actual: Desde Web');
    expect(view.getByText('Tu nombre cambió desde que abriste el formulario.')).toBeTruthy();
    expect(view.getByLabelText('Cómo querés que te llamemos').props.value).toBe('Mobile');
    fireEvent.press(view.getByText('Revisar mi borrador con este valor'));
    expect(view.getByText('Guardar nombre')).toBeTruthy();
  });

  it('Perfil físico opens the shared editor directly on Datos físicos; Plan nutricional opens the index', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    await waitFor(() => expect(view.getByLabelText('Perfil físico').props.accessibilityState?.disabled).toBe(false));
    await act(async () => { fireEvent.press(view.getByLabelText('Perfil físico')); });
    await view.findByText('Guardar datos físicos');
    expect(view.getByLabelText('Peso (kg)').props.value).toBe('80');
    await act(async () => { fireEvent.press(view.getByText('Cerrar configuración')); });
    await waitFor(() => expect(view.queryByTestId('nutrition-config-editor')).toBeNull());
    await act(async () => { fireEvent.press(view.getByLabelText('Plan nutricional')); });
    await view.findByText('Configurar nutrición');
    expect(view.getByText('Editar plan nutricional')).toBeTruthy();
  });

  it('configuration rows are disabled while an unresolved configuration intent exists, with its recovery shown', async () => {
    await AsyncStorage.setItem('ownlevel.nutrition.config.v1.owner', JSON.stringify({ version: 1,
      intent: { operation: 'physical', date: configFixture.today, expectedVersion: v1, idempotencyKey: 'config:pending',
        fields: { birthDate: '1990-01-01', sex: 'male', heightCm: 180, weightKg: 81 } },
      draft: { birthDate: '1990-01-01', sex: 'male', heightCm: '180', weightKg: '81' } }));
    const view = render(element());
    await view.findByText('Revisar intento de configuración');
    expect(view.getByLabelText('Perfil físico').props.accessibilityState?.disabled).toBe(true);
    expect(view.getByLabelText('Plan nutricional').props.accessibilityState?.disabled).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('Métricas diarias navigates to the existing M5.3 route', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    fireEvent.press(view.getByLabelText('Métricas diarias'));
    expect(mockPush).toHaveBeenCalledWith('/settings/metrics');
  });

  it('theme options are the real ones and apply immediately', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    fireEvent.press(view.getByText('Oscuro'));
    expect(view.queryByText(/Usando el tema/)).toBeNull();
    fireEvent.press(view.getByText('Sistema'));
    expect(view.getByText(/Usando el tema (claro|oscuro) del sistema/)).toBeTruthy();
  });

  it('account shows email + Google and logs out through the existing local sign-out', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    expect(view.getByText('Ingresás con Google')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByText('Cerrar sesión en este dispositivo')); });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('a transient logout failure keeps the session and says so', async () => {
    mockAuthState = { status: 'TRANSIENT_ERROR', session: {} };
    const view = render(element());
    await view.findByText('Nacho');
    expect(view.getByText('No pudimos verificar la sesión en este momento. La sesión local se conservó.')).toBeTruthy();
  });

  it('another user never sees the previous user name', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    mockUser = 'second-user'; mockEmail = 'ana@example.com';
    view.rerender(element());
    await view.findByText('Ana');
    expect(view.queryByText('Nacho')).toBeNull();
  });

  it('about shows version/build and the environment outside production; Diagnostics only in __DEV__', async () => {
    const view = render(element());
    await view.findByText('Nacho');
    expect(view.getByText('Versión 1.2.0 (build 42)')).toBeTruthy();
    expect(view.getByText('Entorno: development')).toBeTruthy();
    fireEvent.press(view.getByText('API Diagnostics'));
    expect(mockPush).toHaveBeenCalledWith('/settings/diagnostics');
    view.unmount();
    const dev = (globalThis as unknown as { __DEV__: boolean }).__DEV__;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false; mockAppEnv = 'production';
    try {
      const production = render(element());
      await production.findByText('Nacho');
      expect(production.queryByText('API Diagnostics')).toBeNull();
      expect(production.queryByText(/Entorno:/)).toBeNull();
      production.unmount();
    } finally { (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev; }
  });
});
