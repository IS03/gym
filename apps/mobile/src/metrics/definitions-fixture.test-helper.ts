import { metricDefinitionActions, type MetricDefinition, type MetricSystemKey } from '@/api/metric-definitions';

export const defId = (n: number) => `53000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const DEF_TS = '2026-10-04T12:00:00.123456+00:00';
export function definition(over: Partial<Omit<MetricDefinition, 'actions'>> = {}): MetricDefinition {
  const base = { id: defId(10), systemKey: null as MetricSystemKey | null, name: 'Lectura', unit: 'páginas', valueType: 'integer' as const, target: 20,
    isActive: true, sortOrder: 4, updatedAt: DEF_TS, hasHistory: false, ...over };
  return { ...base, actions: metricDefinitionActions(base) };
}
export const systemDefinitions = (): MetricDefinition[] => [
  definition({ id: defId(1), systemKey: 'steps', name: 'Pasos', unit: 'pasos', valueType: 'integer', target: 10000, sortOrder: 0, hasHistory: true }),
  definition({ id: defId(2), systemKey: 'water', name: 'Agua', unit: 'L', valueType: 'decimal', target: 2.5, sortOrder: 1, hasHistory: true }),
  definition({ id: defId(3), systemKey: 'sleep', name: 'Sueño', unit: 'min', valueType: 'duration', target: 480, sortOrder: 2 }),
];
export const fixtureDefinitions = (): MetricDefinition[] => [
  ...systemDefinitions(),
  definition({ id: defId(10), sortOrder: 3 }),
  definition({ id: defId(11), name: 'Correr', unit: 'km', valueType: 'decimal', target: null, sortOrder: 4, hasHistory: true }),
  definition({ id: defId(12), systemKey: 'mate', name: 'Mate', unit: 'L', valueType: 'decimal', target: null, isActive: false, sortOrder: 2, hasHistory: true }),
];
