import type {
  ProgressMetricDefinition,
  ProgressMetricDomain,
  ProgressMetricSample,
  ProgressPeriodRange,
} from "../analytics";

export const RELATIONSHIP_QUALITY_LABELS = {
  clear: "Señal clara",
  moderate: "Tendencia moderada",
  weak: "Tendencia débil",
  none: "Sin relación clara",
  insufficient: "Datos insuficientes",
} as const;

export type RelationshipQuality = keyof typeof RELATIONSHIP_QUALITY_LABELS;
export type RelationshipDirection = "positive" | "negative" | "none";
export type RelationshipRole = "exposure" | "outcome";
export type RelationshipObservationUnit = "días" | "sesiones" | "semanas" | "mediciones";

export type RelationshipTemporalProfile =
  | { family: "acute"; kind: "same_day"; label: string }
  | { family: "acute"; kind: "previous_day"; lagDays: 1; label: string }
  | { family: "acute"; kind: "same_day_or_next_session"; maximumLagDays: 1; label: string }
  | {
      family: "chronic";
      kind: "trailing_window";
      windowDays: 7 | 14 | 28;
      unit: "week" | "measurement";
      exposureAggregation: "average" | "sum";
      outcomeAggregation: "median" | "sum";
      label: string;
    };

export type RelationshipVariable = {
  key: string;
  metricKey: string;
  domain: ProgressMetricDomain;
  label: string;
  unit: string | null;
  metric: ProgressMetricDefinition | null;
  roles: readonly RelationshipRole[];
  valueKind: "numeric" | "training_performance";
  systemKey: string | null;
  isActive: boolean;
  sampleSize: number;
};

export type RelationshipPair = {
  aKey: string;
  bKey: string;
  temporal: RelationshipTemporalProfile;
  symmetric: boolean;
  relevance: number;
};

export type RelationshipSample = {
  id: string;
  date: string;
  a: number;
  b: number;
  context?: Readonly<Record<string, unknown>>;
};

export type RelationshipSampleSet = {
  samples: RelationshipSample[];
  eligibleCount: number;
  observationUnit: RelationshipObservationUnit;
  omittedMissing: number;
};

export type RelationshipGroupSummary = {
  lower: { count: number; aMedian: number; bMedian: number };
  higher: { count: number; aMedian: number; bMedian: number };
  difference: number;
};

export type RelationshipAnalysis = {
  pair: RelationshipPair;
  variableA: RelationshipVariable;
  variableB: RelationshipVariable;
  period: ProgressPeriodRange;
  quality: RelationshipQuality;
  qualityLabel: (typeof RELATIONSHIP_QUALITY_LABELS)[RelationshipQuality];
  direction: RelationshipDirection;
  conclusion: string;
  interpretation: string;
  insight: string;
  sampleSize: number;
  eligibleCount: number;
  coverageRatio: number | null;
  observationUnit: RelationshipObservationUnit;
  coefficient: number | null;
  stability: number | null;
  distinctA: number;
  distinctB: number;
  groups: RelationshipGroupSummary | null;
  samples: RelationshipSample[];
  insufficientReason: string | null;
  methodology: {
    temporalWindow: string;
    associationMethod: "Spearman por rangos";
    centralTendency: "Mediana";
    missingHandling: "Sólo pares reales; sin imputación";
    notes: string[];
  };
};

export type RelationshipSourceData = {
  samplesByVariable: Readonly<Record<string, readonly ProgressMetricSample[]>>;
};

export type HighlightedRelationship = Pick<RelationshipAnalysis,
  "pair" | "variableA" | "variableB" | "quality" | "qualityLabel" | "direction" |
  "conclusion" | "insight" | "sampleSize" | "observationUnit" | "coverageRatio"
>;

export type RelationshipsWorkspace = {
  period: ProgressPeriodRange & { preset: string; label: string; error: string | null };
  variables: RelationshipVariable[];
  compatiblePairs: RelationshipPair[];
  selectedAKey: string | null;
  selectedBKey: string | null;
  result: RelationshipAnalysis | null;
  highlights: HighlightedRelationship[];
};
