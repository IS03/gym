import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/design-system';
import { historyDayHref, historyReturnParams } from './navigation';
export function ReturnToHistoryDay() {
  const params = useLocalSearchParams(), router = useRouter();
  const origin = historyReturnParams(params);
  return origin ? <Button label="Volver al día" variant="secondary" onPress={() => router.navigate(historyDayHref(origin.historyDate, origin.historyMonth))} /> : null;
}
