import type { ProgressMetricSample, ProgressPeriodRange } from "../analytics";
import { analyzeRelationship } from "./association";
import { alignRelationshipSamples } from "./temporal";
import { RELATIONSHIP_THRESHOLDS } from "./thresholds";
import type {
  HighlightedRelationship,
  RelationshipAnalysis,
  RelationshipPair,
  RelationshipVariable,
} from "./types";

export function analyzeRelationshipPair(input: {
  pair: RelationshipPair;
  variables: readonly RelationshipVariable[];
  samplesByVariable: ReadonlyMap<string, readonly ProgressMetricSample[]>;
  period: ProgressPeriodRange;
  inProgressDate?: string | null;
}): RelationshipAnalysis | null {
  const variableA = input.variables.find((variable) => variable.key === input.pair.aKey);
  const variableB = input.variables.find((variable) => variable.key === input.pair.bKey);
  if (!variableA || !variableB) return null;
  const sampleSet = alignRelationshipSamples({
    a: input.samplesByVariable.get(variableA.key) ?? [],
    b: input.samplesByVariable.get(variableB.key) ?? [],
    period: input.period,
    profile: input.pair.temporal,
    inProgressDate: input.inProgressDate,
  });
  return analyzeRelationship({ pair: input.pair, variableA, variableB, period: input.period, sampleSet });
}

const qualityScore = { clear: 4, moderate: 3, weak: 2, none: 1, insufficient: 0 } as const;

function symmetricIdentity(pair: RelationshipPair) {
  return pair.symmetric ? [pair.aKey, pair.bKey].sort().join("::") : `${pair.aKey}->${pair.bKey}`;
}

function toHighlight(analysis: RelationshipAnalysis): HighlightedRelationship {
  return {
    pair: analysis.pair,
    variableA: analysis.variableA,
    variableB: analysis.variableB,
    quality: analysis.quality,
    qualityLabel: analysis.qualityLabel,
    direction: analysis.direction,
    conclusion: analysis.conclusion,
    insight: analysis.insight,
    sampleSize: analysis.sampleSize,
    observationUnit: analysis.observationUnit,
    coverageRatio: analysis.coverageRatio,
  };
}

/**
 * Highlights analyze a bounded, prefiltered candidate list. They never scan
 * the full metric matrix and never fill the UI with weak/insufficient results.
 */
export function getHighlightedRelationships(input: {
  variables: readonly RelationshipVariable[];
  pairs: readonly RelationshipPair[];
  samplesByVariable: ReadonlyMap<string, readonly ProgressMetricSample[]>;
  period: ProgressPeriodRange;
  inProgressDate?: string | null;
  maximum?: number;
}): HighlightedRelationship[] {
  const byKey = new Map(input.variables.map((variable) => [variable.key, variable]));
  const seen = new Set<string>();
  let dynamicCandidates = 0;
  const candidates = [...input.pairs]
    .sort((left, right) => right.relevance - left.relevance || left.aKey.localeCompare(right.aKey) || left.bKey.localeCompare(right.bKey))
    .filter((pair) => {
      const identity = symmetricIdentity(pair);
      if (seen.has(identity)) return false;
      const a = byKey.get(pair.aKey);
      const b = byKey.get(pair.bKey);
      if (!a || !b || a.sampleSize < 2 || b.sampleSize < 2) return false;
      const genericDynamicPair = a.domain === "activity" && b.domain === "activity" && a.systemKey === null && b.systemKey === null;
      if (genericDynamicPair && dynamicCandidates >= RELATIONSHIP_THRESHOLDS.maximumDynamicHighlightCandidates) return false;
      if (genericDynamicPair) dynamicCandidates += 1;
      seen.add(identity);
      return true;
    })
    .slice(0, RELATIONSHIP_THRESHOLDS.maximumHighlightCandidates);

  const analyses = candidates.flatMap((pair) => {
    const analysis = analyzeRelationshipPair({ ...input, pair });
    return analysis && (analysis.quality === "clear" || analysis.quality === "moderate") ? [analysis] : [];
  }).sort((left, right) => {
    const quality = qualityScore[right.quality] - qualityScore[left.quality];
    if (quality) return quality;
    const coverage = (right.coverageRatio ?? 0) - (left.coverageRatio ?? 0);
    if (coverage) return coverage;
    const magnitude = Math.abs(right.coefficient ?? 0) - Math.abs(left.coefficient ?? 0);
    return magnitude || right.pair.relevance - left.pair.relevance;
  });

  const selected: RelationshipAnalysis[] = [];
  const domainPairs = new Map<string, number>();
  for (const analysis of analyses) {
    const domainPair = `${analysis.variableA.domain}:${analysis.variableB.domain}`;
    if ((domainPairs.get(domainPair) ?? 0) >= 2) continue;
    selected.push(analysis);
    domainPairs.set(domainPair, (domainPairs.get(domainPair) ?? 0) + 1);
    if (selected.length >= (input.maximum ?? RELATIONSHIP_THRESHOLDS.maximumHighlights)) break;
  }
  return selected.map(toHighlight);
}
