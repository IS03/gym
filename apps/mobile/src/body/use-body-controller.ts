import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { MobileApiClient } from '@/api/client';
import { fetchBodyMeasurements, fetchBodyOverview, fetchBodyWeights, mutateBodyMeasurement, mutateBodyWeight } from '@/api/body';
import { shouldRefreshOnForeground } from '@/api/resource';
import { BodyController, type BodyState } from './body-controller';
import { BodyIntentRepository } from './body-storage';

/** One controller per client/user. Focus/foreground re-read server truth; drafts stay. */
export function useBodyController(client: MobileApiClient | null, userId: string) {
  const [current, setCurrent] = useState<{ client: MobileApiClient; userId: string; controller: BodyController; state: BodyState } | null>(null);
  useEffect(() => {
    if (!client) return;
    const life = new AbortController();
    const controller = new BodyController({
      overview: () => fetchBodyOverview(client, life.signal),
      weights: before => fetchBodyWeights(client, before, life.signal),
      measurements: before => fetchBodyMeasurements(client, before, life.signal),
      weight: intent => mutateBodyWeight(client, intent, life.signal),
      measurement: intent => mutateBodyMeasurement(client, intent, life.signal),
    }, new BodyIntentRepository(AsyncStorage, userId));
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
