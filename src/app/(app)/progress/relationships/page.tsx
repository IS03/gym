import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";

import { RelationshipExplorer } from "@/components/progress/relationship-explorer";
import { RelationshipPeriodSelector } from "@/components/progress/relationship-period-selector";
import { RelationshipResult } from "@/components/progress/relationship-result";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { getRelationshipsWorkspace } from "@/lib/progress/relationships/server";
import { getVerifiedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchValue = string | string[] | undefined;

function scalar(value: SearchValue) {
  return typeof value === "string" ? value : undefined;
}

function relationshipHref(input: { a: string; b: string; period: string; from: string; to: string }) {
  const params = new URLSearchParams({ a: input.a, b: input.b, period: input.period, analyze: "1" });
  if (input.period === "custom") {
    params.set("from", input.from);
    params.set("to", input.to);
  }
  return `/progress/relationships?${params.toString()}`;
}

export default async function RelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const search = await searchParams;
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");
  const today = todayInCordoba();
  const analyzed = scalar(search.analyze) === "1";
  const workspace = await getRelationshipsWorkspace({
    period: scalar(search.period),
    from: scalar(search.from),
    to: scalar(search.to),
    aKey: scalar(search.a),
    bKey: scalar(search.b),
    analyze: analyzed,
  }, today, auth);
  const sampleSizeByKey = new Map(workspace.variables.map((variable) => [variable.key, variable.sampleSize]));
  const hasAvailablePair = workspace.compatiblePairs.some((pair) => (
    (sampleSizeByKey.get(pair.aKey) ?? 0) > 0 && (sampleSizeByKey.get(pair.bKey) ?? 0) > 0
  ));

  return <div className="space-y-7 pb-16 lg:pb-0">
    <header className="space-y-4">
      <Link href="/progress" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> Progreso</Link>
      <div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Relaciones</h1><p className="mt-1 text-sm text-muted-foreground">Explorá qué variables parecen acompañarse en tus registros, sin asumir causalidad.</p></div>
      <RelationshipPeriodSelector preset={workspace.period.preset} start={workspace.period.start} end={workspace.period.end} aKey={workspace.selectedAKey} bKey={workspace.selectedBKey} analyzed={analyzed} />
      {workspace.period.error ? <p className="rounded-xl bg-destructive/8 px-3 py-2 text-sm text-destructive" role="alert">{workspace.period.error}</p> : null}
    </header>

    <section aria-labelledby="relationship-explorer-title" className="space-y-3">
      <div><h2 id="relationship-explorer-title" className="text-lg font-semibold tracking-tight">Explorador</h2><p className="text-sm text-muted-foreground">Variable B se limita a resultados compatibles y con datos reales.</p></div>
      {hasAvailablePair ? <RelationshipExplorer
        variables={workspace.variables.map(({ key, domain, label, isActive, sampleSize }) => ({ key, domain, label, isActive, sampleSize }))}
        pairs={workspace.compatiblePairs}
        selectedAKey={workspace.selectedAKey}
        selectedBKey={workspace.selectedBKey}
        period={workspace.period.preset}
        from={workspace.period.start}
        to={workspace.period.end}
      /> : <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">Todavía no hay variables compatibles para analizar. Registrá más datos y probá con un período más largo.</p>}
    </section>

    {workspace.result ? <RelationshipResult result={workspace.result} /> : null}

    <section aria-labelledby="highlighted-relationships-title" className="space-y-3">
      <div><h2 id="highlighted-relationships-title" className="text-lg font-semibold tracking-tight">Relaciones destacadas</h2><p className="text-sm text-muted-foreground">Sólo candidatas aprobadas con cobertura y señal suficientes.</p></div>
      {workspace.highlights.length ? <div className="divide-y overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/8">{workspace.highlights.map((highlight) => <Link key={`${highlight.pair.aKey}:${highlight.pair.bKey}`} href={relationshipHref({ a: highlight.pair.aKey, b: highlight.pair.bKey, period: workspace.period.preset, from: workspace.period.start, to: workspace.period.end })} className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:bg-muted/40">
        <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-medium"><span className="truncate">{highlight.variableA.label}</span><ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden /><span className="truncate">{highlight.variableB.label}</span></span><span className="mt-1 block text-xs text-muted-foreground">{highlight.conclusion} · {highlight.sampleSize} {highlight.observationUnit}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>)}</div> : <p className="rounded-xl border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">No hay relaciones con señal suficiente en este período.</p>}
    </section>
  </div>;
}
