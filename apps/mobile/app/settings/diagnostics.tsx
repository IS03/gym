import { useCallback } from 'react';

import { fetchMobileHome, useApiResource, useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import {
  AppText,
  Button,
  Heading,
  LoadingState,
  ScrollScreen,
  Separator,
  Surface,
  UnavailableState,
} from '@/design-system';

function displayTimestamp(value: number | undefined): string {
  return value
    ? new Date(value).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';
}

function ApiDiagnosticsContent() {
  const { client, config, configurationError, runtime } = useMobileApi();
  const { session } = useMobileAuth();
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!client) {
        return Promise.resolve({
          status: 'unavailable' as const,
          reason: 'invalid_response' as const,
          meta: {
            durationMs: 0,
            httpStatus: null,
            outcome: 'unavailable' as const,
          },
        });
      }
      return fetchMobileHome(client, signal);
    },
    [client],
  );
  const { refresh, state } = useApiResource(load);
  const current =
    state.status === 'ready'
      ? state.current
      : state.status === 'loading'
        ? undefined
        : state.previous;
  const result = state.status === 'loading' ? null : state.result;
  const isRefreshing =
    state.status === 'loading' || (state.status === 'ready' && state.refreshing);

  return (
    <ScrollScreen testID="api-diagnostics-screen">
      <Surface>
        <AppText muted variant="overline">
          DEVELOPMENT / DIAGNOSTICS
        </AppText>
        <Heading>Mobile API Runtime</Heading>
        <AppText muted>
          Prueba temporal del recorrido Expo → Vercel → Supabase. No muestra el payload.
        </AppText>
      </Surface>

      <Surface>
        <Heading level={2}>Runtime</Heading>
        <AppText>API host: {config?.host ?? 'sin configurar'}</AppText>
        <AppText>App env: {config?.appEnv ?? 'sin configurar'}</AppText>
        <AppText>Platform: {runtime?.platform ?? 'no disponible'}</AppText>
        <AppText>Authenticated: {session ? 'yes' : 'no'}</AppText>
      </Surface>

      {configurationError ? (
        <UnavailableState
          description="Revisá EXPO_PUBLIC_OWNLEVEL_API_URL y EXPO_PUBLIC_APP_ENV."
          title="Configuración incompleta"
        />
      ) : null}

      {state.status === 'loading' ? (
        <LoadingState label="Consultando Mobile Home" />
      ) : null}

      <Surface>
        <Heading level={2}>GET /api/mobile/v1/home</Heading>
        <AppText>Request state: {state.status}</AppText>
        <AppText>Outcome: {result?.meta.outcome ?? 'pending'}</AppText>
        <AppText>HTTP: {result?.meta.httpStatus ?? '—'}</AppText>
        <AppText>Duration: {result ? `${result.meta.durationMs} ms` : '—'}</AppText>
        <Separator />
        <AppText>Home date: {current?.data.date ?? '—'}</AppText>
        <AppText>Last confirmed: {displayTimestamp(current?.confirmedAt)}</AppText>
        {state.status === 'unavailable' && state.previous ? (
          <AppText muted>
            La lectura anterior está preservada como stale; no fue confirmada por este refresh.
          </AppText>
        ) : null}
        {state.status === 'unavailable' ? (
          <AppText accessibilityRole="alert" muted>
            Unavailable reason: {state.reason}
          </AppText>
        ) : null}
        <Button
          disabled={isRefreshing || configurationError}
          label={isRefreshing ? 'Actualizando…' : 'Refresh'}
          onPress={() => void refresh()}
        />
      </Surface>
    </ScrollScreen>
  );
}

export default function ApiDiagnosticsScreen() {
  if (!__DEV__) {
    return (
      <ScrollScreen testID="api-diagnostics-disabled-screen">
        <UnavailableState
          description="Esta prueba temporal sólo está habilitada en development builds."
          title="Diagnostics no disponible"
        />
      </ScrollScreen>
    );
  }

  return <ApiDiagnosticsContent />;
}
