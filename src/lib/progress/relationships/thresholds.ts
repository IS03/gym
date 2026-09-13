import type { RelationshipObservationUnit } from "./types";

export const RELATIONSHIP_THRESHOLDS = {
  minimumCoverage: 0.5,
  minimumDistinctValues: 3,
  minimumGroupSize: 4,
  minimumSamples: {
    "días": 12,
    "sesiones": 8,
    "semanas": 6,
    "mediciones": 4,
  } satisfies Record<RelationshipObservationUnit, number>,
  quality: {
    clear: { coefficient: 0.6, samples: 20, coverage: 0.7, stability: 0.35 },
    moderate: { coefficient: 0.4, samples: 12, coverage: 0.55, stability: 0.2 },
    weak: { coefficient: 0.2 },
  },
  maximumHighlights: 3,
  maximumHighlightCandidates: 12,
  maximumDynamicHighlightCandidates: 4,
} as const;
