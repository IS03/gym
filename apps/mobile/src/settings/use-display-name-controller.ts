import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { MobileApiClient } from '@/api/client';
import { fetchProfileIdentity, updateDisplayName } from '@/api/profile-identity';
import { shouldRefreshOnForeground } from '@/api/resource';
import { DisplayNameController, type DisplayNameState } from './display-name-controller';
import { DisplayNameIntentRepository } from './display-name-storage';

/**
 * One controller per client/user. Focus/foreground re-read server truth; drafts stay.
 * Home re-reads its summary on focus, so it reflects a confirmed name on return
 * (no parallel copy of the name to keep in sync).
 */
export function useDisplayNameController(client: MobileApiClient | null, userId: string) {
  const [current, setCurrent] = useState<{ client: MobileApiClient; userId: string; controller: DisplayNameController; state: DisplayNameState } | null>(null);
  useEffect(() => {
    if (!client) return;
    const life = new AbortController();
    const controller = new DisplayNameController({
      read: () => fetchProfileIdentity(client, life.signal),
      write: intent => updateDisplayName(client, intent, life.signal),
    }, new DisplayNameIntentRepository(AsyncStorage, userId));
    const unsubscribe = controller.subscribe(() => setCurrent({ client, userId, controller, state: controller.getSnapshot() }));
    void controller.initialize();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => { if (shouldRefreshOnForeground(previous, next)) void controller.load(); previous = next; });
    return () => { subscription.remove(); unsubscribe(); controller.dispose(); life.abort(); };
  }, [client, userId]);
  const active = current?.client === client && current.userId === userId ? current : null;
  const controller = active?.controller;
  useFocusEffect(useCallback(() => { if (controller && controller.getSnapshot().phase !== 'loading') void controller.load(); }, [controller]));
  return active;
}
