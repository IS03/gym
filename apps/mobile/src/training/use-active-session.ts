import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { MobileApiClient } from '@/api/client';
import { ActiveSessionController, activeSessionApi } from './active-session-controller';
import { SessionDraftRepository } from './active-session-storage';
import { activeSessionStorage } from './active-session-native-storage';

export function useActiveSession(client: MobileApiClient, userId: string, sessionId: string) {
  const controller = useMemo(() => new ActiveSessionController(activeSessionApi(client, sessionId),
    new SessionDraftRepository(activeSessionStorage, userId, sessionId)), [client, sessionId, userId]);
  useEffect(() => {
    controller.activate();
    if (AppState.currentState !== 'active') controller.suspend();
    void controller.refresh();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') controller.suspend();
      else if (previous !== 'active') void controller.resume();
      previous = next;
    });
    return () => { subscription.remove(); controller.dispose(); };
  }, [controller]);
  useFocusEffect(useCallback(() => { void controller.resume(); return () => { controller.suspend(); }; }, [controller]));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { controller, state };
}
