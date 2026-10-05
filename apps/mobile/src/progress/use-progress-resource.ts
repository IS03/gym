import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { MobileApiClient } from '@/api/client';
import type { MobileApiReadResult } from '@/api/results';
import { ApiResourceController, type ApiResourceState, shouldRefreshOnForeground } from '@/api/resource';

/**
 * One server read per key (period [+ metric]). A new key hides the previous
 * scope synchronously, so a slow response for another period is never shown.
 * Focus and foreground re-read server truth.
 */
export function useProgressResource<T>(client: MobileApiClient | null, key: string,
  load: (client: MobileApiClient, signal: AbortSignal) => Promise<MobileApiReadResult<T>>) {
  const initial: ApiResourceState<T> = { status: 'loading', trigger: 'initial' };
  const [reading, setReading] = useState<{ client: MobileApiClient | null; key: string; state: ApiResourceState<T> }>({ client, key, state: initial });
  const active = useRef<{ client: MobileApiClient | null; key: string; controller: ApiResourceController<T> } | null>(null);
  const loader = useRef(load);
  // Declared before the controller effect so a new key always reads with the latest loader.
  useEffect(() => { loader.current = load; }, [load]);
  const state = reading.client === client && reading.key === key ? reading.state : initial;
  const refresh = useCallback(() => {
    const resource = active.current;
    return resource?.client === client && resource.key === key ? resource.controller.refresh('manual') : Promise.resolve();
  }, [client, key]);
  useEffect(() => {
    const controller = new ApiResourceController<T>(signal => client ? loader.current(client, signal)
      : Promise.resolve({ status: 'unavailable' as const, reason: 'invalid_response' as const, meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } }));
    active.current = { client, key, controller };
    const unsubscribe = controller.subscribe(next => setReading({ client, key, state: next }));
    void controller.refresh('initial');
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (shouldRefreshOnForeground(previous, next)) void controller.refresh('foreground');
      previous = next;
    });
    return () => {
      subscription.remove(); unsubscribe(); controller.dispose();
      if (active.current?.controller === controller) active.current = null;
    };
  }, [client, key]);
  const focused = useRef(false);
  // The first focus coincides with the initial read; later focuses refresh.
  useFocusEffect(useCallback(() => { if (focused.current) void refresh(); focused.current = true; }, [refresh]));
  const current = state.status === 'ready' ? state.current : state.status === 'loading' ? undefined : state.previous;
  return { state, data: current?.data, refresh };
}
