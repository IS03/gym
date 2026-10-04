import { useCallback, useState } from 'react';
/** Route input changes the selected date; focus never resets a chosen date. */
export function useDomainDate(routeDate: string | null) {
  const [selection, setSelection] = useState({ routeDate, value: routeDate });
  if (selection.routeDate !== routeDate) setSelection({ routeDate, value: routeDate });
  const selected = selection.routeDate === routeDate ? selection.value : routeDate;
  const select = useCallback((value: string | null) => setSelection({ routeDate, value }), [routeDate]);
  return [selected, select] as const;
}
