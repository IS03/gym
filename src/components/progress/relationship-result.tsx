import { ArrowRight, ChevronDown } from "lucide-react";

import type { RelationshipAnalysis, RelationshipVariable } from "@/lib/progress/relationships/types";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function formatValue(value: number, variable: RelationshipVariable) {
  if (variable.valueKind === "training_performance") return `${number.format(value)}%`;
  if (variable.metric?.metadata?.valueType === "duration") {
    const hours = Math.floor(value / 60);
    const minutes = Math.round(value % 60);
    return hours ? `${hours} h${minutes ? ` ${minutes} min` : ""}` : `${minutes} min`;
  }
  return `${number.format(value)}${variable.unit ? ` ${variable.unit}` : ""}`;
}

function coverageLabel(result: RelationshipAnalysis) {
  return `${result.sampleSize} ${result.observationUnit} analizadas${result.eligibleCount > result.sampleSize ? ` de ${result.eligibleCount} elegibles` : ""}`;
}

function RelationshipVisualization({ result }: { result: RelationshipAnalysis }) {
  if (!result.groups) return <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">La distribución no permite formar dos grupos equilibrados. El resultado usa todos los pares reales disponibles.</div>;
  const values = [result.groups.lower.bMedian, result.groups.higher.bMedian];
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || 1;
  const width = (value: number) => `${Math.max(4, Math.abs(value) / span * 100)}%`;
  return <div className="space-y-4" role="img" aria-label={`Comparación de ${result.variableB.label} entre valores menores y mayores de ${result.variableA.label}`}>
    {[
      { label: `Menor ${result.variableA.label}`, group: result.groups.lower },
      { label: `Mayor ${result.variableA.label}`, group: result.groups.higher },
    ].map(({ label, group }) => <div key={label} className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{label}</span><span className="metric-number font-semibold">{formatValue(group.bMedian, result.variableB)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: width(group.bMedian) }} /></div>
      <p className="text-xs text-muted-foreground">Mediana de B · {group.count} observaciones</p>
    </div>)}
    <p className="border-t pt-3 text-sm text-muted-foreground">Diferencia observada: <span className="font-medium text-foreground">{formatValue(result.groups.difference, result.variableB)}</span></p>
  </div>;
}

export function RelationshipResult({ result }: { result: RelationshipAnalysis }) {
  const direction = result.direction === "positive" ? "positiva" : result.direction === "negative" ? "negativa" : null;
  return <section aria-labelledby="relationship-result-title" className="space-y-6">
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Variables analizadas</p>
      <h2 id="relationship-result-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight"><span>{result.variableA.label}</span><ArrowRight className="size-4 shrink-0 text-primary" aria-hidden /><span>{result.variableB.label}</span></h2>
      <p className="text-sm text-muted-foreground">{result.period.start} — {result.period.end} · {result.pair.temporal.label}</p>
    </div>

    <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Conclusión</p>
      <p className="text-xl font-semibold tracking-tight">{result.conclusion}</p>
    </div>

    <div className="space-y-2"><h3 className="text-base font-semibold">Interpretación</h3><p className="text-sm leading-relaxed text-muted-foreground">{result.interpretation}</p></div>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Cobertura</p><p className="mt-1 font-semibold">{coverageLabel(result)}</p>{result.coverageRatio !== null ? <p className="mt-1 text-xs text-muted-foreground">{number.format(result.coverageRatio * 100)}% de intersección</p> : null}</div>
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Calidad de señal</p><p className="mt-1 font-semibold">{result.qualityLabel}</p>{direction ? <p className="mt-1 text-xs text-muted-foreground">Dirección {direction}</p> : null}</div>
    </div>

    {result.insufficientReason ? <p className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">{result.insufficientReason} Probá un período más largo.</p> : null}

    <div className="space-y-3"><h3 className="text-base font-semibold">Visualización</h3><RelationshipVisualization result={result} /></div>

    <div className="space-y-2"><h3 className="text-base font-semibold">Insight resumido</h3><p className="text-sm leading-relaxed text-muted-foreground">{result.insight}</p></div>

    <details className="rounded-xl border bg-card px-3 py-1.5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium marker:content-none"><span>Ver metodología</span><ChevronDown className="size-4 text-muted-foreground" aria-hidden /></summary>
      <dl className="space-y-3 border-t py-4 text-sm">
        <div><dt className="text-xs text-muted-foreground">Período</dt><dd>{result.period.start} — {result.period.end}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Variables</dt><dd>{result.variableA.label} → {result.variableB.label}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Grain y ventana</dt><dd>{result.observationUnit} · {result.methodology.temporalWindow}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Muestra</dt><dd>{result.sampleSize} pares reales</dd></div>
        <div><dt className="text-xs text-muted-foreground">Missing</dt><dd>{result.methodology.missingHandling}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Método</dt><dd>{result.methodology.associationMethod}; comparación de grupos por {result.methodology.centralTendency.toLocaleLowerCase("es-AR")}.</dd></div>
        {result.coefficient !== null ? <div><dt className="text-xs text-muted-foreground">Coeficiente técnico</dt><dd>ρ = {number.format(result.coefficient)}</dd></div> : null}
        {result.methodology.notes.map((note) => <p key={note} className="text-xs leading-relaxed text-muted-foreground">{note}</p>)}
      </dl>
    </details>
  </section>;
}
