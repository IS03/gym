import { RELATIONSHIP_THRESHOLDS } from "./thresholds";
import {
  RELATIONSHIP_QUALITY_LABELS,
  type RelationshipAnalysis,
  type RelationshipDirection,
  type RelationshipGroupSummary,
  type RelationshipPair,
  type RelationshipQuality,
  type RelationshipSample,
  type RelationshipSampleSet,
  type RelationshipVariable,
} from "./types";
import type { ProgressPeriodRange } from "../analytics";

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function ranks(values: readonly number[]): number[] {
  const sorted = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const result = Array(values.length).fill(0) as number[];
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor + 1;
    while (end < sorted.length && sorted[end]!.value === sorted[cursor]!.value) end += 1;
    const averageRank = (cursor + 1 + end) / 2;
    for (let index = cursor; index < end; index += 1) result[sorted[index]!.index] = averageRank;
    cursor = end;
  }
  return result;
}

function pearson(left: readonly number[], right: readonly number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index]! - leftMean;
    const rightDelta = right[index]! - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  if (leftVariance === 0 || rightVariance === 0) return null;
  return numerator / Math.sqrt(leftVariance * rightVariance);
}

export function spearmanAssociation(samples: readonly Pick<RelationshipSample, "a" | "b">[]): number | null {
  if (samples.length < 2) return null;
  return pearson(ranks(samples.map((sample) => sample.a)), ranks(samples.map((sample) => sample.b)));
}

function splitStability(samples: readonly RelationshipSample[]): number | null {
  if (samples.length < 8) return null;
  const ordered = [...samples].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const middle = Math.floor(ordered.length / 2);
  const first = spearmanAssociation(ordered.slice(0, middle));
  const second = spearmanAssociation(ordered.slice(middle));
  if (first === null || second === null) return 0;
  if (Math.sign(first) !== Math.sign(second)) return 0;
  return Math.min(Math.abs(first), Math.abs(second));
}

function groupSummary(samples: readonly RelationshipSample[]): RelationshipGroupSummary | null {
  if (samples.length < RELATIONSHIP_THRESHOLDS.minimumGroupSize * 2) return null;
  const ordered = [...samples].sort((left, right) => left.a - right.a || left.date.localeCompare(right.date));
  const ideal = Math.floor(ordered.length / 2);
  const cuts = Array.from({ length: ordered.length - 1 }, (_, index) => index + 1)
    .filter((cut) => ordered[cut - 1]!.a !== ordered[cut]!.a)
    .filter((cut) => cut >= RELATIONSHIP_THRESHOLDS.minimumGroupSize && ordered.length - cut >= RELATIONSHIP_THRESHOLDS.minimumGroupSize)
    .sort((left, right) => Math.abs(left - ideal) - Math.abs(right - ideal));
  const cut = cuts[0];
  if (cut === undefined) return null;
  const lower = ordered.slice(0, cut);
  const higher = ordered.slice(cut);
  const lowerB = median(lower.map((sample) => sample.b));
  const higherB = median(higher.map((sample) => sample.b));
  return {
    lower: { count: lower.length, aMedian: median(lower.map((sample) => sample.a)), bMedian: lowerB },
    higher: { count: higher.length, aMedian: median(higher.map((sample) => sample.a)), bMedian: higherB },
    difference: higherB - lowerB,
  };
}

function groupEffect(samples: readonly RelationshipSample[], groups: RelationshipGroupSummary | null): number {
  if (!groups) return 0;
  const values = samples.map((sample) => sample.b).sort((left, right) => left - right);
  const q1 = values[Math.floor((values.length - 1) * 0.25)]!;
  const q3 = values[Math.floor((values.length - 1) * 0.75)]!;
  const scale = q3 - q1 || values.at(-1)! - values[0]!;
  return scale === 0 ? 0 : Math.abs(groups.difference) / scale;
}

function classify(input: {
  coefficient: number;
  sampleSize: number;
  coverageRatio: number;
  stability: number | null;
  effect: number;
  groups: RelationshipGroupSummary | null;
}): RelationshipQuality {
  const magnitude = Math.abs(input.coefficient);
  const stability = input.stability ?? 0;
  if (
    input.groups && input.effect >= 0.25 &&
    magnitude >= RELATIONSHIP_THRESHOLDS.quality.clear.coefficient &&
    input.sampleSize >= RELATIONSHIP_THRESHOLDS.quality.clear.samples &&
    input.coverageRatio >= RELATIONSHIP_THRESHOLDS.quality.clear.coverage &&
    stability >= RELATIONSHIP_THRESHOLDS.quality.clear.stability
  ) return "clear";
  if (
    input.groups && input.effect >= 0.2 &&
    magnitude >= RELATIONSHIP_THRESHOLDS.quality.moderate.coefficient &&
    input.sampleSize >= RELATIONSHIP_THRESHOLDS.quality.moderate.samples &&
    input.coverageRatio >= RELATIONSHIP_THRESHOLDS.quality.moderate.coverage &&
    stability >= RELATIONSHIP_THRESHOLDS.quality.moderate.stability
  ) return "moderate";
  if (magnitude >= RELATIONSHIP_THRESHOLDS.quality.weak.coefficient) return "weak";
  return "none";
}

function directionFor(coefficient: number | null, quality: RelationshipQuality): RelationshipDirection {
  if (coefficient === null || quality === "none" || quality === "insufficient") return "none";
  return coefficient > 0 ? "positive" : "negative";
}

function conclusionFor(quality: RelationshipQuality, direction: RelationshipDirection) {
  if (quality === "insufficient") return "Datos insuficientes";
  if (quality === "none") return "Sin relación clara";
  const directionLabel = direction === "positive" ? "positiva" : "negativa";
  if (quality === "clear") return `Señal ${directionLabel} clara`;
  if (quality === "moderate") return `Tendencia ${directionLabel} moderada`;
  return `Tendencia ${directionLabel} débil`;
}

function interpretationFor(input: {
  quality: RelationshipQuality;
  direction: RelationshipDirection;
  a: RelationshipVariable;
  b: RelationshipVariable;
}) {
  if (input.quality === "insufficient") return "No hay suficientes observaciones reales y compatibles para evaluar esta relación.";
  if (input.quality === "none") return `En tus registros no aparece una relación consistente entre ${input.a.label.toLocaleLowerCase("es-AR")} y ${input.b.label.toLocaleLowerCase("es-AR")} durante este período.`;
  const movement = input.direction === "positive" ? "valores más altos" : "valores más bajos";
  const caution = input.quality === "weak" ? " Aparece una señal leve, pero todavía es poco consistente." : "";
  return `En tus registros, valores más altos de ${input.a.label.toLocaleLowerCase("es-AR")} tendieron a acompañar ${movement} de ${input.b.label.toLocaleLowerCase("es-AR")}.${caution}`;
}

function insightFor(input: { quality: RelationshipQuality; direction: RelationshipDirection; a: RelationshipVariable; b: RelationshipVariable }) {
  if (input.quality === "insufficient") return "No hay suficientes observaciones para evaluar esta relación.";
  if (input.quality === "none") return "Hubo muestra suficiente, pero no apareció una asociación clara.";
  const direction = input.direction === "positive" ? "en la misma dirección" : "en direcciones opuestas";
  return `En este período aparece una ${input.quality === "weak" ? "señal leve" : "tendencia"}: ${input.a.label} y ${input.b.label} se movieron ${direction}.`;
}

function insufficientAnalysis(input: AnalyzeRelationshipInput, reason: string): RelationshipAnalysis {
  return {
    pair: input.pair,
    variableA: input.variableA,
    variableB: input.variableB,
    period: input.period,
    quality: "insufficient",
    qualityLabel: RELATIONSHIP_QUALITY_LABELS.insufficient,
    direction: "none",
    conclusion: "Datos insuficientes",
    interpretation: "No hay suficientes observaciones reales y compatibles para evaluar esta relación.",
    insight: "No hay suficientes observaciones para evaluar esta relación.",
    sampleSize: input.sampleSet.samples.length,
    eligibleCount: input.sampleSet.eligibleCount,
    coverageRatio: input.sampleSet.eligibleCount ? input.sampleSet.samples.length / input.sampleSet.eligibleCount : null,
    observationUnit: input.sampleSet.observationUnit,
    coefficient: null,
    stability: null,
    distinctA: new Set(input.sampleSet.samples.map((sample) => sample.a)).size,
    distinctB: new Set(input.sampleSet.samples.map((sample) => sample.b)).size,
    groups: null,
    samples: input.sampleSet.samples,
    insufficientReason: reason,
    methodology: methodology(input),
  };
}

function methodology(input: AnalyzeRelationshipInput): RelationshipAnalysis["methodology"] {
  const notes = input.variableB.valueKind === "training_performance"
    ? ["El rendimiento conserva exercise_id + weight_mode y se resume como proporción de comparaciones que mejoraron."]
    : [];
  if (input.pair.temporal.family === "chronic" && input.pair.temporal.unit === "week") {
    notes.push("Las observaciones visibles son semanas; las ventanas superpuestas no se cuentan como días independientes.");
  }
  if (input.variableB.domain === "body") notes.push("Se usan fechas reales de medición, sin forward-fill.");
  return {
    temporalWindow: input.pair.temporal.label,
    associationMethod: "Spearman por rangos",
    centralTendency: "Mediana",
    missingHandling: "Sólo pares reales; sin imputación",
    notes,
  };
}

type AnalyzeRelationshipInput = {
  pair: RelationshipPair;
  variableA: RelationshipVariable;
  variableB: RelationshipVariable;
  period: ProgressPeriodRange;
  sampleSet: RelationshipSampleSet;
};

export function analyzeRelationship(input: AnalyzeRelationshipInput): RelationshipAnalysis {
  const sampleSize = input.sampleSet.samples.length;
  const minimum = RELATIONSHIP_THRESHOLDS.minimumSamples[input.sampleSet.observationUnit];
  const coverageRatio = input.sampleSet.eligibleCount ? sampleSize / input.sampleSet.eligibleCount : null;
  const distinctA = new Set(input.sampleSet.samples.map((sample) => sample.a)).size;
  const distinctB = new Set(input.sampleSet.samples.map((sample) => sample.b)).size;
  if (sampleSize < minimum) return insufficientAnalysis(input, `Se necesitan al menos ${minimum} ${input.sampleSet.observationUnit}.`);
  if (coverageRatio === null || coverageRatio < RELATIONSHIP_THRESHOLDS.minimumCoverage) return insufficientAnalysis(input, "La intersección de registros tiene cobertura insuficiente.");
  if (distinctA < RELATIONSHIP_THRESHOLDS.minimumDistinctValues || distinctB < RELATIONSHIP_THRESHOLDS.minimumDistinctValues) {
    return insufficientAnalysis(input, "Una variable no tuvo variación suficiente durante el período.");
  }

  const coefficient = spearmanAssociation(input.sampleSet.samples);
  if (coefficient === null) return insufficientAnalysis(input, "No fue posible estimar la asociación con estos valores.");
  const groups = groupSummary(input.sampleSet.samples);
  const stability = splitStability(input.sampleSet.samples);
  const quality = classify({ coefficient, sampleSize, coverageRatio, stability, effect: groupEffect(input.sampleSet.samples, groups), groups });
  const direction = directionFor(coefficient, quality);
  return {
    pair: input.pair,
    variableA: input.variableA,
    variableB: input.variableB,
    period: input.period,
    quality,
    qualityLabel: RELATIONSHIP_QUALITY_LABELS[quality],
    direction,
    conclusion: conclusionFor(quality, direction),
    interpretation: interpretationFor({ quality, direction, a: input.variableA, b: input.variableB }),
    insight: insightFor({ quality, direction, a: input.variableA, b: input.variableB }),
    sampleSize,
    eligibleCount: input.sampleSet.eligibleCount,
    coverageRatio,
    observationUnit: input.sampleSet.observationUnit,
    coefficient,
    stability,
    distinctA,
    distinctB,
    groups,
    samples: input.sampleSet.samples,
    insufficientReason: null,
    methodology: methodology(input),
  };
}
