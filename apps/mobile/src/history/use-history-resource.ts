import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import type { MobileApiClient } from '@/api/client';
import type { MobileApiReadResult } from '@/api/results';
import { ApiResourceController, shouldRefreshOnForeground, type ApiResourceState } from '@/api/resource';

export function useHistoryResource<T>(scope: string, read: (client: MobileApiClient, signal: AbortSignal) => Promise<MobileApiReadResult<T>>) {
  const { client } = useMobileApi(), { session } = useMobileAuth();
  const key = `${session?.user.id ?? 'anonymous'}:${scope}`;
  const [current, setCurrent] = useState<{ key: string; client: MobileApiClient | null; state: ApiResourceState<T> } | null>(null);
  const active = useRef<{ key: string; client: MobileApiClient | null; resource: ApiResourceController<T> } | null>(null);
  const refresh = useCallback(() => {
    const a = active.current; return a?.key === key && a.client === client ? a.resource.refresh('manual') : Promise.resolve();
  }, [client, key]);
  useEffect(() => {
    const resource = new ApiResourceController<T>(signal => client ? read(client, signal) : Promise.resolve({ status: 'auth_required',
      meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' } }));
    active.current = { key, client, resource };
    const unsubscribe = resource.subscribe(state => setCurrent({ key, client, state }));
    void resource.refresh('initial');
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => { if (shouldRefreshOnForeground(previous, next)) void resource.refresh('foreground'); previous = next; });
    return () => { subscription.remove(); unsubscribe(); resource.dispose(); if (active.current?.resource === resource) active.current = null; };
  }, [client, key, read]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const state: ApiResourceState<T> = current?.key === key && current.client === client ? current.state : { status: 'loading', trigger: 'initial' };
  const data = state.status === 'ready' ? state.current.data : state.status === 'unavailable' ? state.previous?.data : undefined;
  return { state, data, refresh, stale: state.status === 'unavailable' && !!data };
}
