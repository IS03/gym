type EffectivePeriod = { id: string; effective_from: string };

export type PeriodGroups<T extends EffectivePeriod> = {
  current: T | null;
  history: T[];
  upcoming: T[];
};

/**
 * Keeps the semantics of versioned settings explicit: the latest period already
 * in effect is current, earlier periods are history, and future periods remain
 * visible without being presented as historical data.
 */
export function groupConfigurationPeriods<T extends EffectivePeriod>(
  periods: T[],
  today: string,
): PeriodGroups<T> {
  const ordered = [...periods].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  const current = ordered.find((period) => period.effective_from <= today) ?? null;

  return {
    current,
    history: ordered.filter(
      (period) =>
        period.effective_from <= today && period.id !== current?.id,
    ),
    upcoming: ordered.filter((period) => period.effective_from > today),
  };
}
