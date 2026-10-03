import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { MobileApiClient } from '@/api/client';
import { fetchMobileNutritionDay } from '@/api/nutrition-day';
import { mutateManualMeal } from '@/api/nutrition-meal';
import { MealController, type MealEditorState } from './meal-controller';
import { MealIntentRepository } from './meal-storage';
export function useMealController(client: MobileApiClient | null, userId: string, invalidate: (dates: string[]) => void) {
  const [current, setCurrent] = useState<{ client: MobileApiClient; userId: string; controller: MealController; state: MealEditorState } | null>(null);
  useEffect(() => {
    if (!client) return;
    const lifetime = new AbortController();
    const controller = new MealController({ mutate: intent => mutateManualMeal(client, intent, lifetime.signal),
      read: date => fetchMobileNutritionDay(client, date, lifetime.signal) }, new MealIntentRepository(AsyncStorage, userId), invalidate);
    const unsubscribe = controller.subscribe(() => setCurrent({ client, userId, controller, state: controller.getSnapshot() }));
    void controller.initialize();
    return () => { unsubscribe(); controller.dispose(); lifetime.abort(); };
  }, [client, userId, invalidate]);
  return current?.client === client && current.userId === userId ? current : null;
}
